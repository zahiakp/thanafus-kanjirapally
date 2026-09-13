import { API_KEY, ROOT_URL } from "../data/func";

export async function AssignResult(code:any,student: any,program:any,rank:any,grade:any,point:any) {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/x-www-form-urlencoded");
  
    const urlencoded = new URLSearchParams();
    urlencoded.append("code", code);
    urlencoded.append("student", student);
    urlencoded.append("program", program);
    urlencoded.append("rank", rank);
    urlencoded.append("grade", grade);
    urlencoded.append("point", point);
  
    const requestOptions: RequestInit = {
        method: "POST",
        headers: myHeaders,
        body: urlencoded,
        redirect: "follow"
    };
  
    try {
        const response = await fetch(`${ROOT_URL}results/action.php?action=resultUpload`, requestOptions);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const result = await response.text();
      console.log(result); 
      return { success: true}
    } catch (error: any) {
        console.error("Error:", error.message);
        return { success: false, message: error.message }; // Return error message
    }
  }




  export async function MarkAwarded(id:any,status:any) {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/x-www-form-urlencoded");
  
    const urlencoded = new URLSearchParams();
    urlencoded.append("id", id);
    urlencoded.append("status", status);
    const requestOptions: RequestInit = {
        method: "PUT",
        headers: myHeaders,
        body: urlencoded,
        redirect: "follow"
    };
  
    try {
        const response = await fetch(`${ROOT_URL}results/action.php?action=markAwarded`, requestOptions);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const result = await response.text();
      console.log(result); 
      return { success: true}
    } catch (error: any) {
        console.error("Error:", error.message);
        return { success: false, message: error.message }; // Return error message
    }
  }




  export async function ProResult(program:any,_root?:any): Promise<{ success: boolean; data: any[]; message?: string }> {
    try {
      const params = new URLSearchParams({
        program: String(program),
        action: "proResult",
      });
      const response = await fetch(`${ROOT_URL}results/action.php?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        return {
          success: false,
          data: [],
          message: result?.message || `Unable to load program result (${response.status})`,
        };
      }
      return {
        success: true,
        data: Array.isArray(result.data) ? result.data : [],
      };
    } catch (error: any) {
      console.error("Unable to load program result:", error);
      return {
        success: false,
        data: [],
        message: error?.message || "Unable to load program result",
      };
    }
  }
