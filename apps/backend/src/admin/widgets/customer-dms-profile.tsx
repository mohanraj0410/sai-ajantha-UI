import { useEffect, useState } from "react";
import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { Badge, Button, Container, Heading, Text } from "@medusajs/ui";
import { ThemeProvider } from "../components/theme/theme-context";

type CustomerWidgetProps = {
  data: {
    id: string;
    email?: string;
  };
};

interface DmsProfileResponse {
  profile: {
    id: string;
    role: string;
    status: string;
    business_name?: string | null;
    gst_number?: string | null;
    territory?: string | null;
  } | null;
}

const CustomerDmsProfileContent = ({ data }: CustomerWidgetProps) => {
  const [profile, setProfile] = useState<DmsProfileResponse["profile"]>(null);
  const [loaded, setLoaded] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!data?.id) return;
    let active = true;
    fetch(`/admin/sai-ajanta/customers/${data.id}`, {
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: DmsProfileResponse | null) => {
        if (active && json) {
          setProfile(json.profile);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [data?.id]);

  async function updateStatus(nextStatus: "ACTIVE" | "PENDING_APPROVAL" | "SUSPENDED") {
    if (!data?.id || updating) return;
    setUpdating(true);
    try {
      const res = await fetch(`/admin/sai-ajanta/customers/${data.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        const json = (await res.json()) as DmsProfileResponse;
        setProfile(json.profile);
      }
    } finally {
      setUpdating(false);
    }
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h2">Sai Ajantha B2B DMS Tier</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Wholesale role &amp; GST verification linked via DMS Module
          </Text>
        </div>
        {profile ? (
          <Badge
            color={
              profile.status === "ACTIVE"
                ? "green"
                : profile.status === "PENDING_APPROVAL"
                  ? "orange"
                  : "red"
            }
          >
            {profile.role} · {profile.status}
          </Badge>
        ) : (
          <Badge color="grey">
            {loaded ? "Retail Customer (Default)" : "Loading DMS Profile..."}
          </Badge>
        )}
      </div>

      {profile ? (
        <div className="grid grid-cols-1 gap-4 px-6 py-4 md:grid-cols-3">
          <div>
            <Text size="xsmall" className="text-ui-fg-subtle">
              Business / Firm
            </Text>
            <Text size="small" weight="plus">
              {profile.business_name || "—"}
            </Text>
          </div>
          <div>
            <Text size="xsmall" className="text-ui-fg-subtle">
              GSTIN
            </Text>
            <Text size="small" weight="plus">
              {profile.gst_number || "Not Provided"}
            </Text>
          </div>
          <div>
            <Text size="xsmall" className="text-ui-fg-subtle">
              Territory / City
            </Text>
            <Text size="small" weight="plus">
              {profile.territory || "Tamil Nadu / India"}
            </Text>
          </div>
          <div className="md:col-span-3 flex flex-wrap items-center gap-2 pt-2">
            {profile.status !== "ACTIVE" && (
              <Button
                size="small"
                variant="primary"
                disabled={updating}
                onClick={() => void updateStatus("ACTIVE")}
              >
                Approve Wholesale Access
              </Button>
            )}
            {profile.status !== "SUSPENDED" && (
              <Button
                size="small"
                variant="danger"
                disabled={updating}
                onClick={() => void updateStatus("SUSPENDED")}
              >
                Suspend Account
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </Container>
  );
};

const CustomerDmsProfileWidget = (props: CustomerWidgetProps) => {
  return (
    <ThemeProvider>
      <CustomerDmsProfileContent {...props} />
    </ThemeProvider>
  );
};

export const config = defineWidgetConfig({
  zone: "customer.details.after",
});

export default CustomerDmsProfileWidget;
