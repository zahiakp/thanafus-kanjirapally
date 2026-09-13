import { API_KEY, ROOT_URL } from "../data/func";
import axios from "axios";
export async function saveTeam(values: any, categories: string[], edit?: any) {
  try {
    const response = await fetch(ROOT_URL + "campuses/action.php?action=teamSave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: edit?.id || null,
        jamiaNo: values.jamiaNo,
        name: values.name,
        shortname: values.shortname,
        strength: Number(values.strength),
        password: values.password || "",
        categories,
      }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) {
      return {
        success: false,
        message: result?.message || "Unable to save team details",
      };
    }
    return { success: true, message: result.message };
  } catch (error: any) {
    console.error("Unable to save team:", error);
    return {
      success: false,
      message: error?.message || "Unable to save team details",
    };
  }
}

export async function getTeam(teamId:any) {
    try {
      const requestOptions: any = {
        method: "GET",
        redirect: "follow",
      };
  
      const response = await fetch(
        `${ROOT_URL}campuses/action.php?teamId=${teamId}`,
        requestOptions
      );
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const result = await response.json();
      return result;
    } catch (error) {
      console.error("Error:", error);
      return null;
    }
  }

  export async function addTeam(values: any,categories:any) {
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/x-www-form-urlencoded");

    const urlencoded = new URLSearchParams();
    urlencoded.append("jamiaNo", values.jamiaNo);
    urlencoded.append("name", values.name);
    urlencoded.append("shortname", values.shortname);
    urlencoded.append("strength", values.strength.toString()); // Ensure strength is a string
    urlencoded.append("password", values.password);
    urlencoded.append("categories", categories);

    const requestOptions: RequestInit = {
        method: "POST",
        headers: myHeaders,
        body: urlencoded,
        redirect: "follow"
    };

    try {
        const response = await fetch(`${ROOT_URL}campuses/action.php?api=${API_KEY}&action=upload`, requestOptions);
        
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


export async function editTeam(id:any,values: any,categories:any) {
  const myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/x-www-form-urlencoded");

  const urlencoded = new URLSearchParams();
  urlencoded.append("id", id);
  urlencoded.append("jamiaNo", values.jamiaNo);
  urlencoded.append("name", values.name);
  urlencoded.append("shortname", values.shortname);
  urlencoded.append("strength", values.strength.toString()); // Ensure strength is a string
  urlencoded.append("password", values.password);
  urlencoded.append("categories", categories);

  const requestOptions: RequestInit = {
      method: "PUT",
      headers: myHeaders,
      body: urlencoded,
      redirect: "follow"
  };

  try {
      const response = await fetch(`${ROOT_URL}campuses/action.php?api=${API_KEY}&action=update`, requestOptions);
      
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

 export async function getCampuseswithPagination(quary:any) {
    const URL: string = `${ROOT_URL}campuses/action.php?action=pagination&${quary}`;

    try {
      const response = await fetch(URL, { method: "GET", cache: "no-store" });
      const result = await response.json().catch(() => null);

      // Some upstream responses include a valid JSON body even when the HTTP
      // status is not 200. Prefer the payload's success flag over status code.
      if (result?.success) {
        return result;
      }

      if (!response.ok) {
        console.error("Failed to get campuses:", response.status, response.statusText);
        return null;
      }

      return result;
    } catch (error) {
      console.error("Error:", error);
      return null;
    }
  }

export async function getNextTeamId(shortName: string) {
  const prefix = shortName.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!prefix) throw new Error("A team short name is required");

  for (let ordinal = 1; ordinal <= 999; ordinal += 1) {
    const candidate = `${prefix}${String(ordinal).padStart(2, "0")}`;
    const response = await fetch(
      `${ROOT_URL}campuses/action.php?teamId=${encodeURIComponent(candidate)}`,
      { method: "GET", cache: "no-store" }
    );

    if (response.status === 404) return candidate;
    if (!response.ok) {
      throw new Error(`Unable to check team ID ${candidate}`);
    }

    const payload = await response.json();
    const data = payload?.data ?? payload;
    const records = Array.isArray(data) ? data : data ? [data] : [];
    const exists = records.some(
      (team: any) =>
        String(team?.jamiaNo || team?.teamId || "").toUpperCase() === candidate
    );

    if (!exists) return candidate;
  }

  throw new Error(`No available team ID found for ${prefix}`);
}

export async function deleteTeam(id:any,root:any) {
  const myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/x-www-form-urlencoded");

  const urlencoded = new URLSearchParams();
  urlencoded.append("id", id); // Join categories into a comma-separated string

  const requestOptions: RequestInit = {
      method: "DELETE",
      headers: myHeaders,
      body: urlencoded,
      redirect: "follow"
  };

  try {
      const response = await fetch(`${ROOT_URL}campuses/action.php?api=${API_KEY}`, requestOptions);
      
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



// -------------------------access-------------------------


export async function addAccess(values: any,role:any) {
  const myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/x-www-form-urlencoded");

  const urlencoded = new URLSearchParams();
  urlencoded.append("campusId", values.jamiaNo);
  urlencoded.append("username", values.jamiaNo);
  urlencoded.append("role", role);
  urlencoded.append("password", values.password);

  const requestOptions: RequestInit = {
      method: "POST",
      headers: myHeaders,
      body: urlencoded,
      redirect: "follow"
  };

  try {
      const response = await fetch(`${ROOT_URL}access/action.php?api=${API_KEY}&action=teamCreate`, requestOptions);
      
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



export async function editAccess(id:any,values: any,role:any) {
  const myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/x-www-form-urlencoded");

  const urlencoded = new URLSearchParams();
  urlencoded.append("id", id);
  urlencoded.append("campusId", values.jamiaNo);
  urlencoded.append("username", values.jamiaNo);
  urlencoded.append("role", role);
  urlencoded.append("password", values.password);

  const requestOptions: RequestInit = {
      method: "PUT",
      headers: myHeaders,
      body: urlencoded,
      redirect: "follow"
  };

  try {
      const response = await fetch(`${ROOT_URL}access/action.php?api=${API_KEY}&action=teamUpdate`, requestOptions);
      
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



export async function getAccessbyId(id:any) {
  const URL: string = `${ROOT_URL}access/action.php?api=${API_KEY}&id=${id}`;
  
  try {
    const response = await axios.get(URL);

    if (response.status === 200) {
      return response.data;
    } else {
      console.error("Failed to get access:", response.statusText);
      return null; 
    }
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}

export async function getAccessbyJamiaNo(teamId:any) {
  const URL: string = `${ROOT_URL}access/action.php?api=${API_KEY}&campusId=${teamId}`;
  
  try {
    const response = await axios.get(URL);

    if (response.status === 200) {
      return response.data;
    } else {
      console.error("Failed to get access:", response.statusText);
      return null; 
    }
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}


export async function deleteAccess(id:any) {
  const myHeaders = new Headers();
  myHeaders.append("Content-Type", "application/x-www-form-urlencoded");

  const urlencoded = new URLSearchParams();
  urlencoded.append("id", id); // Join categories into a comma-separated string

  const requestOptions: RequestInit = {
      method: "DELETE",
      headers: myHeaders,
      body: urlencoded,
      redirect: "follow"
  };

  try {
      const response = await fetch(`${ROOT_URL}access/action.php?api=${API_KEY}&action=teamDelete`, requestOptions);
      
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




// ------------------------------students------------------------
export async function getStudentsByCampus(category:any) {
  const URL: string = `${ROOT_URL}students/action.php?action=getAllStudents&category=${category}`;
  
  try {
    const response = await axios.get(URL);

    if (response.status === 200) {
      return response.data;
    } else {
      console.error("Failed to get access:", response.statusText);
      return null; 
    }
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}

export async function getStudentsByteamId(teamId:any,quary:any) {
  const URL: string = `${ROOT_URL}students/action.php?campusId=${teamId}&action=pagination&${quary}`;
  
  try {
    const response = await axios.get(URL);

    if (response.status === 200) {
      return response.data;
    } else {
      console.error("Failed to get access:", response.statusText);
      return null; 
    }
  } catch (error) {
    console.error("Error:", error);
    return null;
  }
}
