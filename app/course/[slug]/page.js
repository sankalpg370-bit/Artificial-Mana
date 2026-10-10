import { notFound } from "next/navigation";
import { getCourses } from "../../../lib/courses";
import Classroom from "./Classroom";

export const revalidate = 60;

export async function generateStaticParams() {
  return (await getCourses()).map((c) => ({ slug: c.slug }));
}
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const c = (await getCourses()).find((x) => x.slug === slug);
  return c ? { title: c.title, description: c.description || undefined } : { title: "Not found" };
}
export default async function CoursePage({ params }) {
  const { slug } = await params;
  const course = (await getCourses()).find((c) => c.slug === slug);
  if (!course) notFound();
  return <Classroom course={course} />;
}
