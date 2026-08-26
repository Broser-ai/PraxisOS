import { redirect } from "next/navigation";

/** Live scan-flow er også pause — samme beslutning som /scan */
export default function ScanStartPaused() {
  redirect("/scan");
}
