import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerSessionUser } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { EventService } from '@/lib/events/event.service';
import { NotificationService } from '@/lib/notifications/notification.service';
import { samirPayClient } from '@/lib/samirpay/client';
import crypto from 'crypto';

const CheckoutSchema = z.object({
  eventId: z.string().uuid(),
  items: z.array(z.object({
    categoryId: z.string().uuid(),
    quantity: z.number().int().min(1).max(20)
  })).min(1),
  operator: z.enum(['WAVE', 'ORANGE_MONEY']).optional(),
  customerPhone: z.string().optional(),
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional(),
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getServerSessionUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const body = await req.json();
    const parseResult = CheckoutSchema.safeParse(body);
    
    if (!parseResult.success) {
      return NextResponse.json({ error: 'Données invalides', details: parseResult.error.flatten() }, { status: 400 });
    }

    const { eventId, items, operator, customerPhone, customerName, customerEmail, returnUrl, cancelUrl } = parseResult.data;

    const supabase = getServiceRoleClient();

    // 1. Vérification de l'événement
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, title, status, partner_id')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Événement introuvable.' }, { status: 404 });
    }

    if (event.status !== 'PUBLIE') {
      return NextResponse.json({ error: "La billetterie de cet événement n'est pas disponible." }, { status: 400 });
    }

    // 2. Fetch des catégories et validation
    const categoryIds = items.map(item => item.categoryId);
    const { data: categories, error: catError } = await supabase
      .from('ticket_categories')
      .select('*')
      .in('id', categoryIds)
      .eq('event_id', eventId);

    if (catError || !categories || categories.length !== items.length) {
      return NextResponse.json({ error: 'Une ou plusieurs catégories sont invalides.' }, { status: 400 });
    }

    const freeItems: any[] = [];
    const paidItems: any[] = [];
    let payableAmount = 0;
    
    for (const item of items) {
      const category = categories.find(c => c.id === item.categoryId);
      if (!category) continue;

      if (!category.is_active) {
        return NextResponse.json({ error: `La catégorie ${category.name} n'est plus disponible à la vente.` }, { status: 400 });
      }

      const availableStock = Number(category.total_quantity) - Number(category.sold_quantity || 0);
      if (availableStock <= 0) {
        return NextResponse.json({ error: `La catégorie ${category.name} est épuisée.` }, { status: 400 });
      }
      if (item.quantity > availableStock) {
        return NextResponse.json({ error: `La catégorie ${category.name} n'a plus que ${availableStock} place(s) disponible(s).` }, { status: 400 });
      }

      const price = Number(category.price);
      if (price === 0) {
        freeItems.push(item);
      } else {
        paidItems.push({ ...item, unitPrice: price });
        payableAmount += price * item.quantity;
      }
    }

    // 3. Traiter les billets gratuits
    const freeTicketsGenerated = [];
    const generatedTicketNumbers: string[] = [];

    for (const item of freeItems) {
      const purchaseResult = await EventService.reserveTicketsAtomic({
        eventId,
        categoryId: item.categoryId,
        quantity: item.quantity,
        userId: user.id,
        paymentConfirmed: true,
      });

      if (purchaseResult?.tickets) {
        freeTicketsGenerated.push(...purchaseResult.tickets);
        purchaseResult.tickets.forEach((t: any) => generatedTicketNumbers.push(t.ticket_number));
      }
    }

    if (freeTicketsGenerated.length > 0) {
      try {
        await NotificationService.sendTicketPurchaseNotifications({
          userId: user.id,
          eventId,
          categoryId: freeItems[0].categoryId,
          ticketCount: freeTicketsGenerated.length,
          ticketNumbers: generatedTicketNumbers,
          totalAmount: 0,
          clientPhone: customerPhone,
          clientEmail: customerEmail,
          clientName: customerName,
        });
      } catch (notifErr) {
        console.error('[Checkout API] Erreur envoi notifications gratuits:', notifErr);
      }
    }

    // Si pas d'articles payants, on retourne un succès direct
    if (paidItems.length === 0) {
      return NextResponse.json({
        success: true,
        freeTickets: freeTicketsGenerated,
        payment: null,
        totalPaid: 0,
        totalFree: freeItems.reduce((acc, i) => acc + i.quantity, 0),
        totalTickets: items.reduce((acc, i) => acc + i.quantity, 0),
      });
    }

    // 4. Traiter les billets payants
    // Calcul des frais
    const { data: ticketingConfig } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'ticketing_fee_config')
      .maybeSingle();

    const serviceFeeRate = Number(ticketingConfig?.value?.service_fee_rate || 5) / 100;
    const aggregatorFeeRate = Number(ticketingConfig?.value?.aggregator_fee_rate || 1.5) / 100;

    const aggregatorFee = Math.round(payableAmount * aggregatorFeeRate * 100) / 100;
    const serviceFee = Math.round(payableAmount * serviceFeeRate * 100) / 100;
    const grossRevenue = serviceFee;
    const netRevenue = Math.max(0, grossRevenue - aggregatorFee);
    const partnerPayout = Math.max(0, payableAmount - serviceFee);

    const now = Date.now();
    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const internalTransactionId = `TX-EV-${now}-${randomSuffix}`;
    const externalOrderId = `ORD-EV-${now}-${randomSuffix}`;

    const description = `Panier Billetterie - ${event.title}`;

    const { data: paymentRecord, error: insertError } = await supabase
      .from('payments')
      .insert({
        transaction_id: internalTransactionId,
        external_order_id: externalOrderId,
        client_id: user.id,
        partner_id: event.partner_id,
        payment_target: 'TICKET',
        amount: payableAmount,
        currency: 'XOF',
        is_platform_payment: true,
        aggregator: 'SAMIRPAY',
        aggregator_fee: aggregatorFee,
        service_fee: serviceFee,
        gross_event_village_revenue: grossRevenue,
        net_event_village_revenue: netRevenue,
        partner_payout_amount: partnerPayout,
        status: 'PENDING',
        idempotency_key: `IDEMP-${externalOrderId}`,
        metadata: {
          target_type: 'TICKET',
          event_id: eventId,
          checkout_items: paidItems,
          held_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          customer_phone: customerPhone,
          customer_name: customerName,
          customer_email: customerEmail,
        },
      })
      .select('*')
      .single();

    if (insertError || !paymentRecord) {
      console.error('[Checkout API] Erreur création enregistrement paiement', insertError);
      return NextResponse.json({ error: "Impossible d'enregistrer l'intention de paiement." }, { status: 500 });
    }

    // Phase 2 : Hold Cart — Vérification atomique de la capacité restante sous concurrence
    try {
      for (const item of paidItems) {
        await EventService.verifyAndEnforceHoldAtomic({
          paymentId: paymentRecord.id,
          categoryId: item.categoryId,
          quantity: item.quantity,
          eventId,
        });
      }
    } catch (holdErr: any) {
      return NextResponse.json({
        error: holdErr?.message || 'Stock insuffisant : Des places sont actuellement en cours de réservation par d\'autres acheteurs.'
      }, { status: 400 });
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://eventvillage.sn').replace(/\/+$/, '');
    const callbackUrl = `${appUrl}/api/webhooks/samirpay`;
    const defaultReturnUrl = returnUrl || `${appUrl}/tickets`;
    const defaultCancelUrl = cancelUrl || `${appUrl}/explore`;

    const rawPhone = (customerPhone || '').replace(/\s/g, '');
    const fullIntlPhone = rawPhone.startsWith('+221') ? rawPhone
      : rawPhone.startsWith('221') ? `+${rawPhone}`
      : rawPhone.length > 0 ? `+221${rawPhone}` : '';
    const barePhone = fullIntlPhone.replace(/^\+221/, '');

    const samirPayOperator = operator || 'WAVE';

    let samirPayResponse;
    try {
      samirPayResponse = await samirPayClient.initPayment({
        amount: payableAmount,
        currency: 'XOF',
        order_id: externalOrderId,
        operatorName: samirPayOperator,
        description,
        customer: {
          phone: fullIntlPhone,
          name: customerName || 'Client Event Village',
          email: customerEmail,
        },
        barePhone,
        fullIntlPhone,
        return_url: defaultReturnUrl,
        cancel_url: defaultCancelUrl,
        callback_url: callbackUrl,
      });
    } catch (apiError: any) {
      for (const h of paidItems) {
        await EventService.releaseHoldTicketsAtomic({
          categoryId: h.categoryId,
          quantity: h.quantity,
        });
      }

      await supabase
        .from('payments')
        .update({
          status: 'FAILED',
          provider_status: 'API_ERROR',
          provider_response: { error: apiError?.message || 'Unknown error' },
        })
        .eq('id', paymentRecord.id);

      return NextResponse.json({ error: apiError?.message || 'Erreur API Paiement' }, { status: 500 });
    }

    const externalTransactionId = samirPayResponse.transaction_id || samirPayResponse.data?.transaction_id;
    const paymentUrl = samirPayResponse.payment_url || samirPayResponse.data?.payment_url || samirPayResponse.data?.url;
    const responseBodyStatus = (samirPayResponse.status || '').toLowerCase();
    
    const responseUrls: Record<string, string> =
      (samirPayResponse.data?.urls as Record<string, string>) || (samirPayResponse.urls as Record<string, string>) || {};
    const omRedirectUrl = responseUrls['OM'] || responseUrls['MAXIT'] || responseUrls['OM_URL'] || null;

    const qrCode =
      (samirPayResponse.qr_code as string) || (samirPayResponse.data?.qr_code as string) ||
      (samirPayResponse.qrCode as string) || (samirPayResponse.data?.qrCode as string) ||
      (samirPayResponse.qr as string) || (samirPayResponse.data?.qr as string) || null;

    if (responseBodyStatus === 'failed' || responseBodyStatus === 'error') {
      await supabase.from('payments').update({
        status: 'FAILED',
        provider_status: samirPayResponse.status,
        provider_response: samirPayResponse,
      }).eq('id', paymentRecord.id);

      return NextResponse.json({ error: 'Paiement refusé par l\'opérateur.' }, { status: 400 });
    }

    const isPushUssd = samirPayOperator === 'ORANGE_MONEY' && !paymentUrl && !omRedirectUrl;

    await supabase
      .from('payments')
      .update({
        external_transaction_id: externalTransactionId,
        provider_response: samirPayResponse,
      })
      .eq('id', paymentRecord.id);

    return NextResponse.json({
      success: true,
      freeTickets: freeTicketsGenerated,
      payment: {
        transaction_id: internalTransactionId,
        payment_url: paymentUrl,
        redirect_url: omRedirectUrl || undefined,
        qr_code: qrCode || undefined,
        is_push_ussd: isPushUssd,
        amount: payableAmount,
      },
      totalPaid: payableAmount,
      totalFree: freeItems.reduce((acc, i) => acc + i.quantity, 0),
      totalTickets: items.reduce((acc, i) => acc + i.quantity, 0),
    });

  } catch (error: any) {
    console.error('[Checkout API] Erreur globale:', error);
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
