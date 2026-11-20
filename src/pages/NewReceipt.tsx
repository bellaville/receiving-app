import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "../firebase";
import FormRenderer from "../components/FormRenderer";
import { currentCannabisReceiptForm } from "../forms/receipt.ts";
import { validateForm } from "../forms/validate.ts";
import { initialRaw, type RawValues } from "../forms/types.ts";

export default function NewReceipt({ user }: { user: User }) {
  const navigate = useNavigate();
  const form = currentCannabisReceiptForm;
  const [raw, setRaw] = useState<RawValues>(() => initialRaw(form));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const { values, errors } = validateForm(form, raw);
    setErrors(errors);
    if (Object.keys(errors).length > 0) {
      setSaveError("Fix the highlighted fields.");
      return;
    }

    setSaving(true);
    setSaveError("");
    try {
      await addDoc(collection(db, "cannabis_receipts"), {
        form_version: form.version,
        values,
        created_by: user.email,
        created_at: serverTimestamp(),
      });
      navigate("/");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }

  return (
    <>
      <h1>Add receipt</h1>
      {saveError && <p style={{ color: "red" }}>{saveError}</p>}
      <form onSubmit={handleSubmit} noValidate>
        <FormRenderer
          form={form}
          raw={raw}
          errors={errors}
          disabled={saving}
          onChange={(key, value) => setRaw((r) => ({ ...r, [key]: value }))}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          <button type="button" onClick={() => navigate("/")} disabled={saving}>Cancel</button>
        </div>
      </form>
    </>
  );
}
