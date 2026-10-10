// Change this file to add courses and videos.
// youtubeId: the text after "v=" in a YouTube link (youtube.com/watch?v=THIS_TEXT).
// pdf (optional): the path of a PDF file. Example: pdf: "/pdfs/your-file.pdf".
// Put the PDF file in the public/pdfs folder.
// category (optional): a short name. The home page shows one button for each category.
// quiz (optional): a list of questions. "answer" is the number of the right option. The first option is 0.
export const courses = [
  {
    slug: "intro-to-ai",
    title: "Introduction to Artificial Intelligence",
    description: "Start here. Learn the main ideas of modern AI.",
    category: "Basics",
    lessons: [
      { id: "l1", title: "What is Artificial Intelligence?", youtubeId: "aircAruvnKk", pdf: "/pdfs/sample.pdf",
        quiz: [
          { q: "What does AI stand for?", options: ["Artificial Intelligence", "Automatic Internet", "Applied Information", "Advanced Input"], answer: 0 },
          { q: "Which one is an example of AI?", options: ["A calculator that adds two numbers", "A spam filter that learns from emails", "A paper book", "A light switch"], answer: 1 }
        ] },
      { id: "l2", title: "Machine Learning Basics", youtubeId: "aircAruvnKk",
        quiz: [
          { q: "Machine learning lets a computer do what?", options: ["Learn from data", "Follow fixed rules only", "Turn itself off", "Print paper"], answer: 0 },
          { q: "What is training data?", options: ["Examples the model learns from", "A type of screen", "A password", "A video format"], answer: 0 }
        ] },
      { id: "l3", title: "Neural Networks Explained", youtubeId: "aircAruvnKk" }
    ]
  }
];
