import { Alert, Button, Skeleton, Space, Tabs, Typography } from "antd";

interface Props {
  activeKey: string;
  onChange: (key: string) => void;
  items: { key: string; label: string }[];
  query: {
    data?: { counts: Record<string, number> };
    isPending: boolean;
    isFetching: boolean;
    isError: boolean;
    error: unknown;
    refetch: () => unknown;
  };
  note?: string;
}

export function AdminStatusTabs({ activeKey, onChange, items, query, note }: Props) {
  const forbidden = (query.error as { status?: number } | null)?.status === 403;
  return <div style={{ minWidth: 0, maxWidth: "100%", marginBottom: 10 }} aria-busy={query.isFetching}>
    {query.isError && <Alert type="error" showIcon style={{ marginBottom: 8 }}
      message={forbidden ? "You do not have permission to view these counts." : "Could not refresh records and counts."}
      action={!forbidden && <Button size="small" onClick={() => void query.refetch()}>Retry</Button>} />}
    <Tabs activeKey={activeKey} onChange={onChange} items={items.map(item => ({
      key: item.key,
      label: <Space size={5}>{item.label}{query.isError ? <span aria-label="Count unavailable">—</span>
        : query.isPending || !query.data ? <Skeleton.Input active size="small" style={{ width: 24, minWidth: 24, height: 14 }} />
        : <span>{typeof query.data.counts[item.key] === "number" ? `(${new Intl.NumberFormat("en-IN").format(query.data.counts[item.key])})` : "—"}</span>}</Space>,
    }))} />
    <Typography.Text type="secondary" style={{ display: "block", fontSize: 12 }}>
      {query.isFetching && !query.isPending ? "Refreshing records and counts… " : ""}
      Counts match search and filters across all pages. {note}
    </Typography.Text>
  </div>;
}
