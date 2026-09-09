# Fix Summary: Event Village Test Suite and Event Service Improvements

## Issues Fixed

### 1. Test Suite Pollution in controller-shifts-z.test.ts
**Problem**: The test suite was experiencing failures due to:
- Authentication failures (401 errors) in early tests
- "Session already open" errors when trying to open new shifts  
- Tests expecting no open shift finding one from previous tests

**Root Cause**: `controller_shifts` database records were not being cleaned up after tests, causing:
- Database pollution between test runs
- Secondary effects that manifested as authentication failures
- Test isolation violations

**Solution**: Added proper cleanup of `controller_shifts` records in the test's `after` hook:
```typescript
// Also clean up controller_shifts to prevent test interference
if (createdEventIds.length > 0) {
    await supabase.from('controller_shifts').delete().in('event_id', createdEventIds);
}
```

**Result**: All 9 tests in the suite now pass:
- Test 1: Open shift with valid PIN → PASS
- Test 2: Open shift outside time window → PASS (correctly rejected)
- Test 3: Open shift with invalid PIN → PASS (correctly rejected)
- Test 4: Cash confirmation during open shift → PASS (both payments)
- Test 5: Close shift without discrepancy → PASS
- Test 6: Close shift with discrepancy but no justification → PASS (correctly rejected)
- Test 7: Close shift with discrepancy and justification → PASS
- Test 8: Remove controller with open shift → PASS (correctly blocked)
- Test 9: Scan prepaid ticket without open shift → PASS

### 2. Missing max_per_order Validation in Event Service
**Problem**: In `lib/events/event.service.ts`, the `reserveTicketsAtomic` method was not validating that requested quantities did not exceed the `max_per_order` limit for ticket categories, potentially allowing users to purchase more tickets than allowed per order.

**Solution**: Added explicit validation against `max_per_order`:
```typescript
// Validate quantity against max_per_order (anti-fraude)
if (requestedQty <= 0) {
    throw new Error(`Quantité invalide (${requestedQty}). La quantité doit être supérieure à zéro.`);
}
if (requestedQty > maxPerOrder) {
    throw new Error(`Quantité dépassant la limite autorisée par commande (${maxPerOrder} billets maximum pour la catégorie "${category.name}").`);
}
```

**Result**: The event service now properly enforces the `max_per_order` constraint as specified in the CDC (Cahier des Charges) section 35, preventing users from purchasing more tickets than allowed per order for any ticket category.

## Files Modified
1. `tests/controller-shifts-z.test.ts` - Added controller_shifts cleanup
2. `lib/events/event.service.ts` - Added max_per_order validation in reserveTicketsAtomic

## Impact
- Test suite reliability significantly improved
- Test isolation properly maintained
- Event service now fully compliant with CDC requirements
- No more false failures due to test pollution
- Better anti-fraud protection for ticket purchases