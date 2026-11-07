import { Badge } from "@/components/ui/badge";
import {
  DOMAIN_STATUS,
  ORDER_STATUS,
  PAYMENT_STATUS,
  SSL_STATUS,
  STORE_STATUS,
  VERIFICATION_STATUS,
} from "@/lib/labels";
import type {
  DomainStatus,
  OrderStatus,
  PaymentStatus,
  StoreStatus,
} from "@/lib/types";

export function StoreStatusBadge({ status }: { status: StoreStatus }) {
  const config = STORE_STATUS[status];
  return (
    <Badge tone={config.tone} dot>
      {config.label}
    </Badge>
  );
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config = ORDER_STATUS[status];
  return <Badge tone={config.tone}>{config.label}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const config = PAYMENT_STATUS[status];
  return <Badge tone={config.tone}>{config.label}</Badge>;
}

export function DomainStatusBadge({ status }: { status: DomainStatus }) {
  const config = DOMAIN_STATUS[status];
  return (
    <Badge tone={config.tone} dot>
      {config.label}
    </Badge>
  );
}

export function VerificationBadge({ status }: { status: string }) {
  const config = VERIFICATION_STATUS[status] ?? VERIFICATION_STATUS.pending;
  return <Badge tone={config.tone}>{config.label}</Badge>;
}

export function SslBadge({ status }: { status: string }) {
  const config = SSL_STATUS[status] ?? SSL_STATUS.none;
  return <Badge tone={config.tone}>{config.label}</Badge>;
}
