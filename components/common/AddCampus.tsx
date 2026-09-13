"use client";
import { useEffect, useState } from "react";
import Modal from "./Modal";
import { useFormik } from "formik";
import * as Yup from "yup";
import { getNextTeamId, saveTeam } from "../../app/campus/func";
import { WFormInput } from "./Form";
import { showMessage } from "./CusToast";
import { categoryMap } from "../../app/data/branding";
import { TbReload } from "react-icons/tb";
import { MdPassword } from "react-icons/md";

function createShortName(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Za-z0-9]/g, ""))
    .filter(Boolean);

  if (words.length === 0) return "";
  return (words.length === 1
    ? words[0].slice(0, 3)
    : words.map((word) => word[0]).join("").slice(0, 6)
  ).toUpperCase();
}

function createSecurePassword(length = 16) {
  const groups = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "abcdefghijkmnopqrstuvwxyz",
    "23456789",
    "!@#$%&*_-+",
  ];
  const randomIndex = (size: number) => {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0] % size;
  };
  const password = groups.map((group) => group[randomIndex(group.length)]);
  const all = groups.join("");
  while (password.length < length) password.push(all[randomIndex(all.length)]);
  return password
    .map((character) => ({ character, order: randomIndex(1_000_000) }))
    .sort((a, b) => a.order - b.order)
    .map(({ character }) => character)
    .join("");
}

function AddCampus({ close, edit ,fetchCampuses}: { close: any; edit: any ,fetchCampuses:any}) {
  const [loading, setLoading] = useState(false);
  const [generatingTeamId, setGeneratingTeamId] = useState(false);

  const validationSchema = Yup.object().shape({
    jamiaNo: Yup.string().required("Team Id Required"),
    name: Yup.string().required("Team Name Required"),
    shortname: Yup.string().required("Team Short Name Required"),
    strength: Yup.string().required("Team Strength Required"),
    password: edit
      ? Yup.string().test(
          "optional-password-length",
          "Password must be at least 8 characters",
          (value) => !value || value.length >= 8
        )
      : Yup.string()
          .required("Password Required")
          .min(8, "Password must be at least 8 characters"),
  });

  const formik = useFormik({
    initialValues: {
      jamiaNo: "",
      name: "",
      shortname: "",
      strength: "",
      password: "",
      categories: Object.fromEntries(
        Object.keys(categoryMap).map((key) => [key, false])
      ),
    },

    onSubmit: async (values: any) => {
      setLoading(true);
      try {
        const response = await saveTeam(values, selectedCategories, edit);
        if (response.success) {
          showMessage(edit ? "Campus updated successfully" : "Campus added successfully", "success");
          await fetchCampuses();
          close(false);
        } else {
          showMessage(response.message || "Failed to save campus details", "error");
        }
      } catch (error: any) {
        showMessage(error?.message || "An error occurred. Please try again later.", "error");
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    },
    validationSchema: validationSchema,
  });

  const generateTeamId = async (shortName: string) => {
    const normalizedShortName = shortName.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (!normalizedShortName || edit) return;

    formik.setFieldValue("shortname", normalizedShortName);
    setGeneratingTeamId(true);
    try {
      formik.setFieldValue("jamiaNo", await getNextTeamId(normalizedShortName), true);
    } catch (error: any) {
      formik.setFieldValue("jamiaNo", "", true);
      showMessage(error.message || "Could not generate a unique team ID", "error");
    } finally {
      setGeneratingTeamId(false);
    }
  };

  const handleNameBlur = (event: any) => {
    formik.handleBlur(event);
    if (edit) return;
    const shortName = createShortName(event.target.value);
    if (shortName) void generateTeamId(shortName);
  };

  const handleShortNameBlur = (event: any) => {
    formik.handleBlur(event);
    if (!edit) void generateTeamId(event.target.value);
  };

  const selectedCategories = Object.keys(formik.values.categories).filter(
    (key) => formik.values.categories[key]
  );

  useEffect(() => {
    if (edit) {
      // Create a new categories object based on the edit data
const categories = Object.fromEntries(
  Object.keys(categoryMap).map(key => [
    key,
    edit?.categories?.includes(key) || false
  ])
);

      formik.setValues({
        jamiaNo: edit?.jamiaNo,
        name: edit?.name,
        shortname: edit?.shortName,
        strength: edit?.strength,
        password: "",
        categories: categories,
      });
    }
  }, [edit]);
  return (
    <Modal close={close} edit={edit} className={"md:min-w-[700px"}>
      <form className="flex flex-col gap-3" onSubmit={formik.handleSubmit}>
        <h6 className="font-bold text-2xl mb-3 w-full text-center">
          {edit ? "Edit Team" : "Add Team"}
        </h6>
        <WFormInput formik={formik} name="name" placeHolder="Team Name" onBlur={handleNameBlur} />
        <WFormInput
          formik={formik}
          name="shortname"
          placeHolder="Team Short Name"
          onBlur={handleShortNameBlur}
        />
        <div className="relative">
          <WFormInput formik={formik} name="jamiaNo" placeHolder="Team Id" disabled={edit}/>
          {generatingTeamId && (
            <TbReload className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-primary-600" aria-label="Generating team ID" />
          )}
        </div>
        <WFormInput
          formik={formik}
          name="strength"
          placeHolder="Team Strength"
          type="number"
        />
        <div className="flex flex-col">
          <div className="flex gap-4">
            <input
              type="text"
              className={`w-input pr-14  flex-1 ${formik.errors.password && formik.touched.password ? "focus:outline-red-500 border-red-500" : "border-gray-300"}`}
              placeholder={edit ? "Leave blank to keep the current password" : "Use a strong unique password"}
              name="password"
              value={formik.values.password}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => {
                formik.setFieldValue("password", createSecurePassword(), true);
                formik.setFieldTouched("password", true, false);
              }}
              className=" bg-primary-500 text-white rounded-lg  p-2.5 px-4  hover:bg-primary-600"
              aria-label="Generate unique password"
              title="Generate unique password"
            >
              <MdPassword className="text-xl" />
            </button>
          </div>
          {formik.errors.password && formik.touched.password && (
            <div className="text-red-600 text-xs mt-2">{String(formik.errors.password)}</div>
          )}
        </div>
        <h6>Categories</h6>
        <div className="bg-primary-50 p-4 grid grid-cols-2 gap-3 rounded-lg">
          {Object.keys(formik.values.categories).map((category: any) => (
            <div key={category}>
              <label className="flex items-center cursor-pointer select-none">
                <input
                  className="checkbox border-primary-500 [--chkbg:theme(colors.primary.500)] [--chk:white] mr-3"
                  type="checkbox"
                  name={`categories.${category}`}
                  checked={formik.values.categories[category]}
                  onChange={() => {
                    // Toggle the checkbox value
                    formik.setFieldValue(
                      `categories.${category}`,
                      !formik.values.categories[category]
                    );
                  }}
                />
                {categoryMap[category] || category}
              </label>
            </div>
            // <WCheckbox key={category} formik={formik} name={`categories.${category}`} label={category}/>
            // <WCheckbox formik={formik} name="categories.premier" label="Premier"/>
            // <WCheckbox formik={formik} name="categories.subJunior" label="Sub Junior"/>
            // <WCheckbox formik={formik} name="categories.junior" label="Junior"/>
            // <WCheckbox formik={formik} name="categories.senior" label="Senior"/>
          ))}
        </div>
        <button
          type="submit"
          className="bg-gradient-to-r from-primary-400 to-primary-600 text-white p-3 rounded-lg mt-3 font-semibold flex justify-center"
          disabled={loading}
        >
          {loading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>{" "}
              Proccessing...
            </>
          ) : edit ? (
            "Edit Team"
          ) : (
            "Add Team"
          )}
        </button>
      </form>
    </Modal>
  );
}

export default AddCampus;
