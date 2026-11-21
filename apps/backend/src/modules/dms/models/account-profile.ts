import { model } from "@medusajs/framework/utils";

export enum AccountRole {
  CUSTOMER = "CUSTOMER",
  DEALER = "DEALER",
  DISTRIBUTOR = "DISTRIBUTOR",
}

export enum AccountStatus {
  ACTIVE = "ACTIVE",
  PENDING_APPROVAL = "PENDING_APPROVAL",
  SUSPENDED = "SUSPENDED",
}

const AccountProfile = model.define("account_profile", {
  id: model.id({ prefix: "dms_prof" }).primaryKey(),
  // 1-to-1 reference to Medusa's native customer.id
  customer_id: model.text().unique().index(),
  role: model.enum(AccountRole).default(AccountRole.CUSTOMER).index(),
  status: model.enum(AccountStatus).default(AccountStatus.ACTIVE),

  // Populated when role === DEALER; null for DISTRIBUTOR or CUSTOMER
  parent_distributor_id: model.text().index().nullable(),

  // Populated when role === DISTRIBUTOR (links to Medusa's native stock_location.id)
  stock_location_id: model.text().nullable(),

  // Core B2B commercial fields
  business_name: model.text().nullable(),
  gst_number: model.text().nullable(),
  territory: model.text().nullable(),

  // Flexible JSONB for trade licenses, credit limits, or custom terms
  dynamic_attributes: model.json().nullable(),
});

export default AccountProfile;