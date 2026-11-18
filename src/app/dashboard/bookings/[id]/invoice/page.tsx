import InvoiceView from "@/components/dashboard/InvoiceView";

export const instant = false;

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="container-page py-8">
      <InvoiceView bookingId={id} />
    </div>
  );
}
