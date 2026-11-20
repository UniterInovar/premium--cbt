export type QuestionType = {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
};

export const MOCK_QUESTIONS: QuestionType[] = [
  {
    id: "q1",
    text: "Calculate the momentum of a 5kg mass moving at 10m/s.",
    options: ["50 kgm/s", "2 kgm/s", "0.5 kgm/s", "15 kgm/s"],
    correctAnswer: 0,
    explanation: "Momentum p = mass × velocity = 5kg × 10m/s = 50 kgm/s"
  },
  {
    id: "q2",
    text: "Which of the following describes the first law of thermodynamics?",
    options: ["Entropy always increases", "Energy cannot be created or destroyed", "F = ma", "PV = nRT"],
    correctAnswer: 1,
    explanation: "The first law of thermodynamics asserts the conservation of energy."
  },
  {
    id: "q3",
    text: "In a right-angled triangle, if the adjacent side is 3 and opposite side is 4, what is the hypotenuse?",
    options: ["5", "6", "7", "25"],
    correctAnswer: 0,
    explanation: "Using Pythagoras theorem: c² = a² + b² => c² = 3² + 4² = 9 + 16 = 25 => c = 5."
  },
  {
    id: "q4",
    text: "Who was the first president of Nigeria?",
    options: ["Nnamdi Azikiwe", "Abubakar Tafawa Balewa", "Obafemi Awolowo", "Ahmadu Bello"],
    correctAnswer: 0,
    explanation: "Nnamdi Azikiwe became the first president of Nigeria in 1963."
  },
  {
    id: "q5",
    text: "Evaluate: (2.5 &times; 10<sup>4</sup>) / (5.0 &times; 10<sup>2</sup>)",
    options: ["50", "20", "5", "500"],
    correctAnswer: 0,
    explanation: "2.5/5.0 = 0.5. 10⁴/10² = 10². 0.5 × 100 = 50."
  },
  {
    id: "q6",
    text: "What is the capital of Australia?",
    options: ["Sydney", "Melbourne", "Canberra", "Perth"],
    correctAnswer: 2,
    explanation: "Canberra is the capital city of Australia."
  },
  {
    id: "q7",
    text: "Solve for x: 2x + 5 = 15",
    options: ["x = 5", "x = 10", "x = 7.5", "x = -5"],
    correctAnswer: 0,
    explanation: "2x + 5 = 15 => 2x = 10 => x = 5"
  },
  {
    id: "q8",
    text: "What is the chemical symbol for Gold?",
    options: ["Go", "Gd", "Au", "Ag"],
    correctAnswer: 2,
    explanation: "Au comes from the Latin word 'aurum' meaning gold."
  },
  {
    id: "q9",
    text: "A resistor has color bands: Brown, Black, Red. What is its resistance?",
    options: ["10 ohms", "100 ohms", "1000 ohms", "10000 ohms"],
    correctAnswer: 2,
    explanation: "Brown(1), Black(0), Red(x100) = 10 x 100 = 1000 ohms."
  },
  {
    id: "q10",
    text: "If a cell has 16 chromosomes before meiosis, how many chromosomes will each daughter cell have?",
    options: ["8", "16", "32", "4"],
    correctAnswer: 0,
    explanation: "Meiosis reduces the chromosome number by half."
  }
];
