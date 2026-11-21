import { Module } from "@medusajs/framework/utils";
import DmsModuleService from "./services";

export const DMS_MODULE = "dms";

export default Module(DMS_MODULE, {
  service: DmsModuleService,
});