import { getCourses } from "../lib/courses";

export const revalidate = 3600;

export default async function sitemap() {
  const base = "https://artificialmana.com";
  const courses = await getCourses();
  return [
    { url: base },
    { url: base + "/about" },
    { url: base + "/privacy" },
    ...courses.map((c) => ({ url: `${base}/course/${c.slug}` })),
  ];
}
