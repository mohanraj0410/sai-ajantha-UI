"use client";

import { StorefrontSurface } from "@/components/non-home/StorefrontSurface";

import { PageHeader } from "@/components/non-home/PageHeader";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Send,
} from "lucide-react";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { useStore } from "@/components/StoreProvider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PRODUCT_CATEGORIES } from "@/lib/products";

function InstallationContent() {
  const searchParams = useSearchParams();
  const { session, deliveryPincode } = useStore();

  const [category, setCategory] = useState(
    searchParams.get("category") || PRODUCT_CATEGORIES[0]
  );
  const [productRef, setProductRef] = useState(searchParams.get("sku") || "");
  const [contactName, setContactName] = useState(session?.name || "");
  const [phone, setPhone] = useState(session?.phone || "");
  const [email, setEmail] = useState(session?.email || "");
  const [city, setCity] = useState(session?.businessCity || "Trichy");
  const [pincode, setPincode] = useState(deliveryPincode || "");
  const [preferredDate, setPreferredDate] = useState("");
  const [siteDetails, setSiteDetails] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!contactName.trim() || !phone.trim()) {
      setError("Contact name and mobile number are required.");
      return;
    }
    if (!/^\d{6}$/.test(pincode.trim())) {
      setError("Enter a valid 6-digit site PIN code.");
      return;
    }
    if (!siteDetails.trim()) {
      setError("Describe the installation scope or number of openings.");
      return;
    }

    setSubmitting(true);
    try {
      const notes = [
        `[Separate Installation Request — Independent Contractor Flow]`,
        `Category: ${category}`,
        productRef.trim() ? `Product / SKU Reference: ${productRef.trim()}` : "",
        `Site PIN: ${pincode.trim()}`,
        preferredDate ? `Preferred Date: ${preferredDate}` : "",
        `Scope: ${siteDetails.trim()}`,
      ]
        .filter(Boolean)
        .join("\n");

      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contactName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          city: city.trim(),
          role: session?.role || "Homeowner",
          division: `Installation: ${category}`,
          notes,
          source: "installation-request",
        }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setError(data.error || "Unable to submit installation request.");
        return;
      }
      setSubmittedRef(data.id);
    } catch {
      setError("Network error submitting installation request.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="sa-content-width pt-6 sm:pt-8 space-y-6">



      {/* Mandatory Policy Disclosure */}
      <Alert variant="teal" className="border-[#079D9A]/40 bg-[#E5F7F6]/70">
        <Info className="size-4" />
        <AlertTitle className="text-xs sm:text-sm font-bold text-[#102D4D]">
          How installation is billed
        </AlertTitle>
        <AlertDescription className="text-xs text-[#4A5B6E] leading-relaxed mt-1">
          Direct product orders do not include installation, and installation charges are never bundled into product cart checkout. Sai Ajantha forwards your site request to a verified contractor who quotes, bills, and collects installation charges independently.
        </AlertDescription>
      </Alert>

      <Card className="p-6 sm:p-8">
        {submittedRef ? (
          <div className="space-y-5 py-4">
            <Alert variant="success">
              <CheckCircle2 className="size-5" />
              <AlertTitle className="font-bold">Installation Request Logged</AlertTitle>
              <AlertDescription className="text-xs sm:text-sm mt-1">
                Reference ID: <strong className="font-mono">{submittedRef}</strong>. Our desk will connect your site details with a verified independent contractor for a separate fitting quotation.
              </AlertDescription>
            </Alert>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline-navy">
                <Link href="/products">Return to Products</Link>
              </Button>
              <Button asChild variant="teal">
                <Link href="/quotes">Request Product Quote</Link>
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Product Category" htmlFor="inst-cat" required>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="inst-cat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="Product / Order Reference (Optional)" htmlFor="inst-ref">
                <Input
                  id="inst-ref"
                  value={productRef}
                  onChange={(e) => setProductRef(e.target.value)}
                  placeholder="e.g. SKU code or order number"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Contact Name" htmlFor="inst-name" required>
                <Input
                  id="inst-name"
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </FormField>
              <FormField label="Mobile Number" htmlFor="inst-phone" required>
                <Input
                  id="inst-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91"
                />
              </FormField>
              <FormField label="Email (Optional)" htmlFor="inst-email">
                <Input
                  id="inst-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Site PIN Code" htmlFor="inst-pin" required>
                <Input
                  id="inst-pin"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="620003"
                />
              </FormField>
              <FormField label="City / Area" htmlFor="inst-city" required>
                <Input
                  id="inst-city"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </FormField>
              <FormField label="Preferred Visit Date (Optional)" htmlFor="inst-date">
                <Input
                  id="inst-date"
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                />
              </FormField>
            </div>

            <FormField label="Installation Scope & Aperture Count" htmlFor="inst-scope" required>
              <Textarea
                id="inst-scope"
                rows={4}
                required
                value={siteDetails}
                onChange={(e) => setSiteDetails(e.target.value)}
                placeholder="Describe number of doors/windows, floor level, or whether products are already delivered..."
              />
            </FormField>

            <Button type="submit" variant="teal" size="lg" disabled={submitting} className="w-full">
              <Send className="size-4" />
              {submitting ? "Submitting Request..." : "Submit Separate Installation Request"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}

export default function InstallationPage() {
  return (
    <StorefrontSurface family="commerce">
    <div className="min-h-screen flex flex-col bg-white">
      <Header />
      <main className="flex-1 pb-12 sm:pb-16">
        <PageHeader title="Installation help" section="Separate contractor service" description="Ask us to connect you with a contractor. They quote and bill for installation separately."  />

        <Suspense fallback={<div className="p-12 text-center text-sm text-[#526274]">Loading installation form...</div>}>
          <InstallationContent />
        </Suspense>
      </main>
      <Footer />
    </div>
    </StorefrontSurface>
  );
}
