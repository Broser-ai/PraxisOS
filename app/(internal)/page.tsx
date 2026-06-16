import { redirect } from "next/navigation";

// Roden viser review-startsiden (guided tour). Dashboard ligger på /dashboard.
export default function Root() {
  redirect("/review");
}
