export const loginFunc = async (username: string, password: string) => {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      result?.message ||
        (response.status >= 500
          ? "The login service is unavailable. Please try again."
          : "Login failed. Please check your credentials."),
    );
  }

  if (!result) {
    throw new Error("The login service returned an invalid response.");
  }

  return result;
};