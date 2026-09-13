import axios from "axios";
import { ROOT_URL } from "../../data/func";

export async function getProfile(id: string) {
  const URL: string = `${ROOT_URL}students/action.php?action=profileDetails&id=${encodeURIComponent(id)}`;

  try {
    const response = await axios.get(URL);
    return response.data;
  } catch (error) {
    // axios rejects on every non-2xx status, so the previous `response.status === 200`
    // branch was unreachable and every failure collapsed into a single null. That made
    // an expired session, a missing participant, a backend fault and an offline device
    // all render the same "Participant Not Found" card. Return the backend's own JSON
    // body when there is one so the caller can show the real reason.
    if (axios.isAxiosError(error)) {
      const data = error.response?.data;
      if (data && typeof data === "object") return data;
      return {
        success: false,
        message: error.response
          ? `Profile request failed with status ${error.response.status}`
          : "Could not reach the server. Check your connection and try again.",
      };
    }
    console.error("Error:", error);
    return { success: false, message: "Unexpected error while loading the profile." };
  }
}
