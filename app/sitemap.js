import { getCourses } from "../lib/courses";
import { SITE_URL } from "../lib/site";

export const revalidate = 3600;

export default async function sitemap() {
  const base = SITE_URL;
  const courses = await getCourses();
  return [
    { url: base },
    { url: base + "/about" },
    { url: base + "/privacy" },
    ...courses.map((c) => ({ url: `${base}/course/${c.slug}` })),
  ];
}
