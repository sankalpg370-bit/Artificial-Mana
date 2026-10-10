import MyList from "./MyList";
import CourseBrowser from "./CourseBrowser";
import { getCourses } from "../lib/courses";

export const revalidate = 60; // The page updates up to 1 minute after you change a course.

export default async function Home() {
  const courses = await getCourses();
  return (
    <div className="wrap">
      <h1>Learn Artificial Intelligence</h1>
      <p className="muted">Free video courses. Learn one step at a time.</p>
      <MyList courses={courses} />
      <CourseBrowser courses={courses} />
    </div>
  );
}
