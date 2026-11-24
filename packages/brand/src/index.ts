export type Brand = Readonly<{
  name: string;
  description: string;
  url: string;
  themeColor: string;
  backgroundColor: string;
}>;

export const brand: Brand = Object.freeze({
  name: "Organyz Work",
  description: "Issues, projects, and code reviews for the Organyz team.",
  url: "https://work.organyz.ai",
  themeColor: "#141414",
  backgroundColor: "#141414",
});
