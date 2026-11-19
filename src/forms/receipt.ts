import type { FormDef } from "./types.ts";

// To change the form:
//  - Rewording a label: edit it in place.
//  - Adding, removing or changing a field: copy the current version to a new constant,
//    bump `version`, add it to receiptFormVersions, and point currentReceiptForm at it.
//    Keep old versions so old receipts still display with their original fields.
//  - Then run `npm run gen:rules` and deploy the rules.

const receiptFormV1: FormDef = {
  version: 1,
  sections: [
    {
      title: "Shipment",
      fields: [
        { key: "name", label: "Shipping Operator", type: "text", required: true, maxLength: 200, inList: true },
        { key: "date_received", label: "Date Received", type: "date", required: true, inList: true },
      ],
    },
    {
      title: "Lots",
      fields: [
        { key: "supplier_lot", label: "Supplier Lot", type: "text", required: true, maxLength: 200, inList: true },
        { key: "growtown_lot", label: "Growtown Lot", type: "text", required: true, maxLength: 200, inList: true },
      ],
    },
  ],
};

const receiptFormV2: FormDef = {
  version: 2,
  sections: [
    {
      title: "Shipment",
      fields: [
        { key: "name", label: "Shipping Operator", type: "text", required: true, maxLength: 200, inList: true },
        { key: "date_received", label: "Date Received", type: "date", required: true, inList: true },
        { key: "returned_product", label: "Is Returned Product?", type: "checkbox", required: true, inList: true },
      ],
    },
    {
      title: "Lots",
      fields: [
        { key: "supplier_lot", label: "Supplier Lot", type: "text", required: true, maxLength: 200, inList: true },
        { key: "growtown_lot", label: "Growtown Lot", type: "text", required: true, maxLength: 200, inList: true },
      ],
    },
  ],
};

const WEIGHT = { type: "number", required: true, min: 0, decimals: 2, unit: "g" } as const;

const receiptFormV3: FormDef = {
  version: 3,
  sections: [
    {
      title: "Shipment",
      fields: [
        { key: "name", label: "Shipping Operator", type: "text", required: true, maxLength: 200, inList: true },
        { key: "date_received", label: "Date Received", type: "date", required: true, inList: true },
        { key: "returned_product", label: "Is Returned Product?", type: "select", options: ["Yes", "No"], required: true, inList: true },
      ],
    },
    {
      title: "Lots",
      fields: [
        { key: "supplier_lot", label: "Supplier Lot", type: "text", required: true, maxLength: 200, inList: true },
        { key: "growtown_lot", label: "Growtown Lot", type: "text", required: true, maxLength: 200, inList: true },
      ],
    },
    {
      title: "Items",
      fields: [
        {
          key: "items", label: "Items", type: "group", itemLabel: "Item", minItems: 1, maxItems: 10, inList: true,
          fields: [
            { key: "item_number", label: "Item Number", type: "text", required: true, maxLength: 200 },
            { key: "vessel_number", label: "Vessel Number", type: "text", required: true, maxLength: 200 },
            { key: "supplier_tare_weight", label: "Supplier Tare Weight", ...WEIGHT },
            { key: "supplier_net_weight", label: "Supplier Net Weight", ...WEIGHT },
            { key: "growtown_net_weight", label: "Growtown Net Weight", ...WEIGHT },
            { key: "packaging_check", label: "Packaging Check", type: "select", options: ["Pass", "Fail"], required: true },
            { key: "comments", label: "Comments", type: "textarea", maxLength: 500 },
          ],
        },
      ],
    },
  ],
};

export const receiptFormVersions: Record<number, FormDef> = {
  1: receiptFormV1,
  2: receiptFormV2,
  3: receiptFormV3,
};

export const currentReceiptForm = receiptFormV3;
