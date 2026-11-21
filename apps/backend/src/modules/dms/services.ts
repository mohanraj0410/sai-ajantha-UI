import { MedusaError, MedusaService } from "@medusajs/framework/utils";
import AccountProfile, { AccountRole } from "./models/account-profile";
import AdminSetting from "./models/admin-setting";
import IdempotencyKey from "./models/idempotency-key";
import InventoryMovement from "./models/inventory-movement";
import StaffAuditEvent from "./models/staff-audit-event";
import StockReservation from "./models/stock-reservation";
import TradeEnquiry from "./models/trade-enquiry";
import TradeOrder from "./models/trade-order";
import TradePayment from "./models/trade-payment";
import TradePromoDraft from "./models/trade-promo-draft";
import TradeQuote from "./models/trade-quote";
import WebhookInbox from "./models/webhook-inbox";
import ProductImportJob from "./models/product-import-job";
import ProductImportRow from "./models/product-import-row";
import DistributorCoverage from "./models/distributor-coverage";
import DistributorPo from "./models/distributor-po";
import DistributorReceipt from "./models/distributor-receipt";
import DistributorInventory from "./models/distributor-inventory";
import DistributorResaleQuote from "./models/distributor-resale-quote";

class DmsModuleService extends MedusaService({
  AccountProfile,
  AdminSetting,
  TradeEnquiry,
  TradeOrder,
  TradePayment,
  TradePromoDraft,
  TradeQuote,
  IdempotencyKey,
  WebhookInbox,
  StockReservation,
  InventoryMovement,
  StaffAuditEvent,
  ProductImportJob,
  ProductImportRow,
  DistributorCoverage,
  DistributorPo,
  DistributorReceipt,
  DistributorInventory,
  DistributorResaleQuote,
}) {
  async listDealersByDistributor(distributorProfileId: string) {
    return await this.listAccountProfiles({
      role: AccountRole.DEALER,
      parent_distributor_id: distributorProfileId,
    });
  }

  async assignDealerToDistributor(
    dealerProfileId: string,
    distributorProfileId: string
  ) {
    const distributor = await this.retrieveAccountProfile(distributorProfileId);

    if (distributor.role !== AccountRole.DISTRIBUTOR) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Profile ${distributorProfileId} is not a valid DISTRIBUTOR.`
      );
    }

    const dealer = await this.retrieveAccountProfile(dealerProfileId);

    if (dealer.role !== AccountRole.DEALER) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Profile ${dealerProfileId} is not a DEALER account.`
      );
    }

    return await this.updateAccountProfiles({
      id: dealerProfileId,
      parent_distributor_id: distributorProfileId,
    });
  }
}

export default DmsModuleService;