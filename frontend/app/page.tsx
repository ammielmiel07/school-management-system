import { redirect } from "next/navigation";

export default function Home() {
  // Automatically redirect anyone visiting localhost:3000 to the login page
  redirect("/login");
}