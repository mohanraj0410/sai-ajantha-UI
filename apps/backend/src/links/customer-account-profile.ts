import { defineLink } from "@medusajs/framework/utils";
import CustomerModule from "@medusajs/medusa/customer";
import DmsModule from "../modules/dms";

export default defineLink(
  CustomerModule.linkable.customer,
  DmsModule.linkable.accountProfile
);