import type { FormDef } from "./types.ts";

// Each version is issued as a controlled blank form in the EQMS, so any change to `sections`,
// including rewording a label, needs a new version:
//  1. Copy the current version to a new constant, bump `version`, make the change, add it to
//     receiptFormVersions and point currentCannabisReceiptForm at it. Keep old versions so
//     old receipts still display with their original fields.
//  2. Run `npm run gen:rules` and `npm run lock:forms`, then deploy the rules.
//  3. Run `npm run gen:blank-pdf` and upload the PDF to Dot Compliance as the new revision of
//     the controlled form. Set controlledDoc.revision once it is approved.
// `npm run build` fails if a locked version's sections change (check:forms).

const receiptFormV1: FormDef = {
  version: 1,
  title: "Cannabis Receipt",
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
  title: "Cannabis Receipt",
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
  title: "Cannabis Receipt",
  controlledDoc: { number: "TMP.9.1.2", revision: "" }, // revision: fill in once approved in Dot Compliance
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

export const currentCannabisReceiptForm = receiptFormV3;
