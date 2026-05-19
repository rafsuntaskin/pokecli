import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

type Choice<T extends string> = {
  name: string;
  value: T;
};

export async function askInput(options: {
  message: string;
  default?: string;
  required?: boolean;
  validate?: (value: string) => true | string;
}): Promise<string> {
  const rl = createInterface({ input, output });

  try {
    while (true) {
      const suffix = options.default ? ` (${options.default})` : "";
      const answer = (await rl.question(`${options.message}${suffix}: `)).trim() || options.default || "";

      if (options.required && !answer) {
        console.log("A value is required.");
        continue;
      }

      const validation = options.validate?.(answer) ?? true;
      if (validation !== true) {
        console.log(validation);
        continue;
      }

      return answer;
    }
  } finally {
    rl.close();
  }
}

export async function askConfirm(options: { message: string; default?: boolean }): Promise<boolean> {
  const defaultValue = options.default ?? false;
  const hint = defaultValue ? "Y/n" : "y/N";
  const answer = await askInput({ message: `${options.message} (${hint})` });

  if (!answer) return defaultValue;
  return ["y", "yes", "true", "1"].includes(answer.toLowerCase());
}

export async function askSelect<T extends string>(options: {
  message: string;
  choices: Choice<T>[];
}): Promise<T> {
  console.log(options.message);
  options.choices.forEach((choice, index) => {
    console.log(`  ${index + 1}. ${choice.name}`);
  });

  const answer = await askInput({
    message: "Choose",
    default: "1",
    validate: (value) => {
      const index = Number(value);
      return Number.isInteger(index) && index >= 1 && index <= options.choices.length
        ? true
        : `Enter a number from 1 to ${options.choices.length}.`;
    },
  });

  return options.choices[Number(answer) - 1]!.value;
}
