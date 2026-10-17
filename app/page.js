import Link from "next/link";
import MyList from "./MyList";
import CourseBrowser from "./CourseBrowser";
import HeroBoard from "./HeroBoard";
import { publicSignupEnabled } from "../lib/backend-config";
import { getCourses } from "../lib/courses";

export const revalidate = 60; // The page updates up to 1 minute after you change a course.

const FEATURES = [
  ["Short video lessons", "Watch at your own pace. Play All starts the next lesson for you.",
    <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M10 9.5v5l4.5-2.5z" /></>],
  ["Notes tied to the video", "Write a note at any second. Click its time to jump back to that moment.",
    <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></>],
  ["Boards for drawing", "Use a chalkboard or a diagram board. Watch the teacher board during a lesson.",
    <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M7 12c2-4 4 2 6-1s3-1 4-3" /><path d="M8 21h8" /></>],
  ["Quizzes and certificates", "Check what you learned. Finish a course to download your certificate.",
    <><circle cx="12" cy="9" r="5" /><path d="M9 13.5L7.5 21 12 18.5l4.5 2.5L15 13.5" /></>],
];

export default async function Home() {
  const signup = publicSignupEnabled();
  const courses = await getCourses();
  const lessons = courses.reduce((n, c) => n + c.lessons.length, 0);
  return (
    <>
      <section className="hero">
        <div className="hero-in">
          <div>
            <h1>Learn artificial intelligence, one lesson at a time</h1>
            <p className="lead">Watch short video lessons. Write notes at any moment, draw on the board, and test yourself with quizzes. It is free. No account is needed.</p>
            <div className="hero-actions">
              <a className="btn primary lg" href="#courses">Browse courses</a>
              {signup && <Link className="btn lg" href="/login">Sign up free</Link>}
            </div>
            <p className="hero-facts">{courses.length} {courses.length === 1 ? "course" : "courses"}, {lessons} {lessons === 1 ? "lesson" : "lessons"}, and a certificate when you finish.</p>
          </div>
          <div className="hero-board"><HeroBoard /></div>
        </div>
      </section>
      <div className="container">
        <MyList courses={courses} />
        <section id="courses" className="section"><CourseBrowser courses={courses} /></section>
        <div className="features">
          {FEATURES.map(([title, text, icon]) => (
            <div key={title} className="feat">
              <svg viewBox="0 0 24 24" aria-hidden="true">{icon}</svg>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </div>
      <section className="cta-band">
        <div className="cta-in">
          <div>
            <h2>Make your first note today</h2>
            <p>{signup ? "Create a free account to keep your progress, notes, and boards on every device." : "Start a lesson without signing up. Your notes, progress, and drawings stay in this browser."}</p>
          </div>
          <Link className="btn lg" href={signup ? "/login" : "#courses"}>{signup ? "Sign up free" : "Start learning"}</Link>
        </div>
      </section>
    </>
  );
}
