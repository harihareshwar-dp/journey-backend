const questions = [
  {
    "topic": "Binomial Theorem",
    "difficulty": "easy",
    "question": "Find the coefficient of the term $x^3$ in the expansion of $(2 + x)^4$. Show all steps.",
    "markscheme": {
      "total_marks": 4,
      "steps": [
        {"step": "State the general binomial term: $T_{r+1} = \\binom{n}{r} a^{n-r} b^r$", "marks": 1},
        {"step": "Identify $r = 3$ to match $x^3$ (since $b = x$)", "marks": 1},
        {"step": "Substitute into the formula: $\\binom{4}{3} \\cdot 2^{1} \\cdot x^3$", "marks": 1},
        {"step": "Simplify: Coefficient = $4 \\cdot 2 = 8$", "marks": 1}
      ],
      "common_errors": [
        "Incorrect formula (e.g., using $a^r b^{n-r}$)",
        "Wrong value for $r$",
        "Omitting the coefficient of 2"
      ]
    }
  },
  {
    "topic": "Binomial Theorem",
    "difficulty": "easy",
    "question": "Find the coefficient of $x^2$ in the expansion of $(1 + 3x)^5$.",
    "markscheme": {
      "total_marks": 4,
      "steps": [
        {"step": "Use general term: $T_{r+1} = \\binom{5}{r} (1)^{5-r} (3x)^r$", "marks": 1},
        {"step": "Identify $r = 2$ since we want $x^2$", "marks": 1},
        {"step": "Compute: $\\binom{5}{2} \\cdot 3^2 \\cdot x^2 = 10 \\cdot 9 \\cdot x^2$", "marks": 1},
        {"step": "Final coefficient = $90$", "marks": 1}
      ],
      "common_errors": [
        "Forgetting to raise 3 to the power of $r$",
        "Confusing powers of $x$",
        "Omitting constant base 1"
      ]
    }
  },
  {
    "topic": "Binomial Theorem",
    "difficulty": "easy",
    "question": "Determine the coefficient of $x^4$ in the expansion of $(x + 2)^6$.",
    "markscheme": {
      "total_marks": 4,
      "steps": [
        {"step": "General term: $T_{r+1} = \\binom{6}{r} x^r \\cdot 2^{6-r}$", "marks": 1},
        {"step": "We want $r = 4$ to get $x^4$", "marks": 1},
        {"step": "Evaluate: $\\binom{6}{4} \\cdot 2^2 = 15 \\cdot 4$", "marks": 1},
        {"step": "Final coefficient = $60$", "marks": 1}
      ],
      "common_errors": [
        "Incorrect exponent pairing",
        "Using $x^{6-r}$ instead of $x^r$",
        "Arithmetic mistake with binomial coefficient"
      ]
    }
  },
  {
    "topic": "Binomial Theorem",
    "difficulty": "medium",
    "question": "Find the coefficient of $x^5$ in the expansion of $(3x + \\frac{1}{x})^6$.",
    "markscheme": {
      "total_marks": 4,
      "steps": [
        {"step": "Use general term: $T_{r+1} = \\binom{6}{r} (3x)^{6−r} (\\frac{1}{x})^r$", "marks": 1},
        {"step": "Simplify: $x^{6−r} \\cdot x^{-r} = x^{6−2r}$", "marks": 1},
        {"step": "Set $6−2r = 5 \\Rightarrow r = 0.5$ (not valid)", "marks": 1},
        {"step": "Conclude no such term exists", "marks": 1}
      ],
      "common_errors": [
        "Not recognizing $r$ must be an integer",
        "Wrong simplification of powers",
        "Assuming a term exists without verifying"
      ]
    }
  },
  {
    "topic": "Binomial Theorem",
    "difficulty": "medium",
    "question": "Find the coefficient of $x^{-2}$ in the expansion of $(x^2 + \\frac{3}{x})^5$.",
    "markscheme": {
      "total_marks": 4,
      "steps": [
        {"step": "Use: $T_{r+1} = \\binom{5}{r} x^{2(5-r)} \\cdot (\\frac{3}{x})^r$", "marks": 1},
        {"step": "Simplify: $x^{10−2r} \\cdot x^{-r} = x^{10−3r}$", "marks": 1},
        {"step": "Set $10−3r = -2 \\Rightarrow r = 4$", "marks": 1},
        {"step": "Substitute: $\\binom{5}{4} \\cdot 3^4 = 5 \\cdot 81 = 405$", "marks": 1}
      ],
      "common_errors": [
        "Incorrect simplification of $x$ powers",
        "Wrong binomial coefficient",
        "Sign error in substitution"
      ]
    }
  },
  {
    "topic": "Binomial Theorem",
    "difficulty": "medium",
    "question": "What is the coefficient of $x$ in the expansion of $(2x + \\frac{1}{x^2})^7$?",
    "markscheme": {
      "total_marks": 4,
      "steps": [
        {"step": "Term: $T_{r+1} = \\binom{7}{r} (2x)^{7−r} (\\frac{1}{x^2})^r$", "marks": 1},
        {"step": "Simplify exponent: $x^{7−r} \\cdot x^{-2r} = x^{7−3r}$", "marks": 1},
        {"step": "Set $7−3r = 1 \\Rightarrow r = 2$", "marks": 1},
        {"step": "Coefficient: $\\binom{7}{2} \\cdot 2^5 = 21 \\cdot 32 = 672$", "marks": 1}
      ],
      "common_errors": [
        "Exponent simplification mistake",
        "Arithmetic errors",
        "Wrong binomial term used"
      ]
    }
  },
  {
    "topic": "Binomial Theorem",
    "difficulty": "hard",
    "question": "Find the constant term (term independent of $x$) in the expansion of $(2x^2 - \\frac{1}{x})^9$.",
    "markscheme": {
      "total_marks": 5,
      "steps": [
        {"step": "General term: $T_{r+1} = \\binom{9}{r} (2x^2)^{9−r} (-\\frac{1}{x})^r$", "marks": 1},
        {"step": "Simplify powers: $x^{2(9−r)} \\cdot x^{-r} = x^{18−3r}$", "marks": 1},
        {"step": "Set $18−3r = 0 \\Rightarrow r = 6$", "marks": 1},
        {"step": "Substitute: $\\binom{9}{6} \\cdot 2^3 \\cdot (-1)^6 = 84 \\cdot 8 \\cdot 1$", "marks": 1},
        {"step": "Final coefficient: $672$", "marks": 1}
      ],
      "common_errors": [
        "Power simplification errors",
        "Sign error with $(-1)^r$",
        "Wrong value of $r$"
      ]
    }
  },
  {
    "topic": "Binomial Theorem",
    "difficulty": "hard",
    "question": "Determine the coefficient of $x^0$ in the expansion of $(x^3 + \\frac{2}{x^2})^8$.",
    "markscheme": {
      "total_marks": 5,
      "steps": [
        {"step": "General term: $T_{r+1} = \\binom{8}{r} x^{3(8−r)} (\\frac{2}{x^2})^r$", "marks": 1},
        {"step": "Simplify: $x^{24−3r} \\cdot x^{-2r} = x^{24−5r}$", "marks": 1},
        {"step": "Set $24−5r = 0 \\Rightarrow r = 4.8$ (invalid)", "marks": 1},
        {"step": "Conclusion: No constant term in this expansion", "marks": 1},
        {"step": "Justify using integer $r$ constraint", "marks": 1}
      ],
      "common_errors": [
        "Incorrect simplification of exponents",
        "Assuming fractional $r$ is valid",
        "Skipping justification"
      ]
    }
  },
  {
    "topic": "Binomial Theorem",
    "difficulty": "hard",
    "question": "Find the coefficient of the term independent of $x$ in the expansion of $(3x + \\frac{2}{x^2})^7$.",
    "markscheme": {
      "total_marks": 5,
      "steps": [
        {"step": "Use: $T_{r+1} = \\binom{7}{r} (3x)^{7−r} (\\frac{2}{x^2})^r$", "marks": 1},
        {"step": "Simplify powers: $x^{7−r} \\cdot x^{-2r} = x^{7−3r}$", "marks": 1},
        {"step": "Set $7−3r = 0 \\Rightarrow r = \\frac{7}{3}$ (invalid)", "marks": 1},
        {"step": "Conclude no such term exists", "marks": 1},
        {"step": "Explain that $r$ must be integer", "marks": 1}
      ],
      "common_errors": [
        "Treating non-integer $r$ as valid",
        "Incorrect exponent handling",
        "Forgetting to test feasibility of result"
      ]
    }
  }
]




module.exports = { questions };
  