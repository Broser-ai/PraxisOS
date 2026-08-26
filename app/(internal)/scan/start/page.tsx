import { redirect } from "next/navigation";

/** Capture flow bor på /scan (Nexus panel med kamera/upload) */
export default function ScanStartPage() {
  redirect("/scan");
}
