/**
 * Gift vouchers, on or off.
 *
 * Parked rather than removed: the schema, the stored procedures, the purchase
 * flow, the account tab, the checkout field and the admin screen all stay
 * compiled and typechecked, so none of it can rot while it is away. Flip this
 * to true to bring the whole feature back.
 *
 * Every surface reads this ONE constant -- the buy page, the account tab, the
 * checkout box, the admin nav -- and so does the server action that actually
 * spends a voucher. That last one matters: hiding the input would still leave
 * a redemption endpoint that a crafted POST could reach, so the switch has to
 * be enforced where the money moves, not only where the field is drawn.
 */
export const VOUCHERS_ENABLED = false;
