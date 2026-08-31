/**
 * Dictionnaire centralisé des messages de notification (Toasts)
 * Règle de design : Phrases naturelles, chaleureuses, professionnelles (B2B / B2C / Admin).
 * Zéro jargon technique, zéro code d'erreur SQL ou nom de colonne brut.
 */

export const toastMessages = {
  admin: {
    partnerValidated: (companyName: string) =>
      `Le partenaire « ${companyName} » a été validé avec succès.`,
    partnerRejected: (companyName: string) =>
      `La demande du partenaire « ${companyName} » a été rejetée.`,
    partnerSuspended: (companyName: string) =>
      `Le compte du partenaire « ${companyName} » a été suspendu.`,
    partnerActivated: (companyName: string) =>
      `Le compte du partenaire « ${companyName} » a été réactivé.`,
    partnerRatesUpdated: (companyName: string) =>
      `Les taux de parrainage personnalisés ont bien été enregistrés pour « ${companyName} ».`,
    ratesUpdatedSuccess: 'Les taux de parrainage et paliers ont été enregistrés avec succès.',
    permissionUpdated: (role: string) =>
      `Les permissions du rôle « ${role} » ont été mises à jour.`,
    docLoadError: 'Impossible d\'accéder au document justificatif sur le stockage sécurisé.',
    loadError: 'Impossible d\'actualiser les données du tableau de bord d\'administration.',
  },

  events: {
    createdDraft: 'Votre événement a été enregistré en brouillon.',
    updated: (title?: string) =>
      title
        ? `L'événement « ${title} » a été mis à jour avec succès.`
        : 'Votre événement a bien été mis à jour.',
    submitted: (title?: string) =>
      title
        ? `L'événement « ${title} » a été soumis pour validation à l'équipe Event Village.`
        : 'Votre événement a été soumis pour validation à l\'équipe Event Village.',
    deleted: 'L\'événement a bien été supprimé.',
    notFound: 'Cet événement est introuvable ou n\'est plus disponible.',
    formErrors: 'Veuillez vérifier les informations indiquées dans le formulaire.',
    createError: 'La création de l\'événement n\'a pas pu aboutir. Veuillez réessayer.',
    updateError: 'La modification de l\'événement n\'a pas pu être enregistrée.',
    submitError: 'La soumission pour validation a échoué. Veuillez réessayer.',
    deleteError: 'La suppression de l\'événement n\'a pas pu être effectuée.',
  },

  halls: {
    created: (name?: string) =>
      name ? `La salle « ${name} » a bien été ajoutée à votre catalogue.` : 'La salle a été créée avec succès.',
    updated: (name?: string) =>
      name ? `La fiche de la salle « ${name} » a été mise à jour.` : 'La salle a été mise à jour avec succès.',
    deleted: 'La salle a bien été supprimée de votre catalogue.',
    reservationConfirmed: 'La réservation a été confirmée avec succès.',
    reservationCancelled: 'La réservation a bien été annulée.',
    loadError: 'Impossible de charger la liste de vos salles. Veuillez rafraîchir la page.',
    notFound: 'Cette salle est introuvable ou a été retirée.',
    createError: 'L\'enregistrement de la salle n\'a pas pu aboutir. Veuillez vérifier les champs requis.',
    updateError: 'La modification de la salle n\'a pas pu être enregistrée.',
    deleteError: 'La suppression de la salle a échoué. Veuillez réessayer.',
    confirmError: 'La confirmation de la réservation n\'a pas pu être effectuée.',
    cancelError: 'L\'annulation de la réservation a échoué.',
  },

  tables: {
    zoneCreated: (name?: string) =>
      name ? `L'espace « ${name} » a été créé avec succès.` : 'La zone a été créée avec succès.',
    zoneUpdated: (name?: string) =>
      name ? `L'espace « ${name} » a été mis à jour.` : 'La zone a été mise à jour avec succès.',
    zoneDeleted: 'L\'espace a bien été supprimé.',
    tableCreated: (num?: string) =>
      num ? `La table n°${num} a bien été ajoutée.` : 'La table a été créée avec succès.',
    tableUpdated: (num?: string) =>
      num ? `La table n°${num} a été mise à jour.` : 'La table a été mise à jour avec succès.',
    tableDeleted: 'La table a bien été supprimée.',
    reservationConfirmed: 'La réservation de table a été confirmée avec succès.',
    reservationCancelled: 'La réservation de table a bien été annulée.',
    loadError: 'Impossible de charger les données de votre plan de salle.',
    loadReservationsError: 'Impossible de charger la liste des réservations de tables.',
    operationError: 'L\'enregistrement n\'a pas pu aboutir. Veuillez réessayer.',
    deleteError: 'La suppression n\'a pas pu être effectuée.',
  },

  products: {
    created: (name?: string) =>
      name ? `Le produit « ${name} » a été ajouté à votre catalogue.` : 'Le produit a été créé avec succès.',
    updated: (name?: string) =>
      name ? `Le produit « ${name} » a été mis à jour avec succès.` : 'Le produit a été mis à jour.',
    stockIn: (name?: string) =>
      name ? `« ${name} » est de nouveau disponible en stock.` : 'Le produit a été remis en stock.',
    stockOut: (name?: string) =>
      name ? `« ${name} » a été marqué comme indisponible.` : 'Le produit a été marqué en rupture de stock.',
    deleted: 'Le produit a bien été retiré de votre catalogue.',
    loadError: 'Impossible de charger votre catalogue de produits.',
    notFound: 'Ce produit est introuvable.',
    saveError: 'L\'enregistrement du produit n\'a pas pu aboutir.',
    statusError: 'Impossible de modifier la disponibilité de cet article.',
    deleteError: 'La suppression du produit a échoué.',
  },

  orders: {
    statusUpdated: (statusLabel: string) => `La commande est passée au statut : ${statusLabel}.`,
    updateError: 'Le changement de statut de la commande n\'a pas pu être enregistré.',
    loadError: 'Impossible de charger les commandes récentes.',
  },

  finance: {
    withdrawalSuccess: (amount?: number) =>
      amount
        ? `Votre demande de retrait de ${amount.toLocaleString('fr-FR')} FCFA a été transmise à notre service financier.`
        : 'Votre demande de retrait a été transmise avec succès à notre service financier.',
    withdrawalError: 'Votre demande de retrait n\'a pas pu être traitée. Veuillez vérifier votre solde disponible.',
    loadError: 'Impossible d\'actualiser vos données financières.',
  },

  common: {
    networkError: 'Une erreur de connexion est survenue. Veuillez vérifier votre réseau.',
    validationError: 'Veuillez vérifier et corriger les erreurs indiquées dans le formulaire.',
    unexpectedError: 'Une erreur inattendue est survenue. Veuillez réessayer dans quelques instants.',
  },
};
