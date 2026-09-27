import React, { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import { TbExchange } from "react-icons/tb";
import { toPng } from "html-to-image";
import LDRloader from "./LDRloader";
import { categoryMap } from "../../app/data/branding";
import { resultPosterTemplates } from "../../app/data/resultPosterTemplates";

function PosterCanvas({ close, data }: { close: any; data: any }) {
  const elementRef: any = useRef(null);
  const [image, setImage] = useState<any>();
  const [frame, setFrame] = useState<any>();
  const [downloading, setDownloading] = useState(false);
  const [loading, setLoading] = useState(false);

  const { program, result } = data;
  console.log("data", data);

  const temp: any = resultPosterTemplates;

  function getNextFrame(currentFrame: any, frames: any[]) {
    let currentIndex = frames.findIndex(
      (f) => f === currentFrame || f.frame === currentFrame?.frame
    );
    let nextIndex = (currentIndex + 1) % frames.length;
    return frames[nextIndex];
  }

  const getRandomImage = (imagesArray: any[]) => {
    const randomIndex = Math.floor(Math.random() * imagesArray.length);
    return imagesArray[randomIndex];
  };

  // Initial frame setup
  useEffect(() => {
    setFrame(temp[0]);
  }, []);

  // When frame changes, pick new image + set loading
  useEffect(() => {
    if (frame) {
      // setLoading(true);
      setImage(getRandomImage(frame.data));
    }
  }, [frame]);

  const handleNextFrame = () => {
    setFrame((prev: any) => getNextFrame(prev, temp));
  };

  const htmlToImageConvert = () => {
    setDownloading(true);
    toPng(elementRef.current, {
      cacheBust: false,
      pixelRatio: 4,
    })
      .then((dataUrl) => {
        const link = document.createElement("a");
        link.download = `${program.category + "_" + program.name.toLowerCase()}.jpg`;
        link.href = dataUrl;
        link.click();
        setDownloading(false);
      })
      .catch((err) => {
        console.error(err);
        setDownloading(false);
      });
  };

const orderGenerator = (order: any) => {
    return String(order || "").padStart(2, "0");
  };

  // Frame renderer
  const renderFrameContent = () => {
    if (!frame) return null;

  
    if (["1","2","3"].includes(frame?.frame)) {
      return (
        <>
          <div className="absolute top-[105px] left-[80px]">
            <h6 className="mb-5 montserrat font-light text-gray-900 text-[12px] grid content-end leading-6 mt-7 w-[160px] h-[72px] align-text-bottom">
             
                {categoryMap[program.category] || program.category} <br /> <span className="font-bold text-2xl">{program.name}</span>
                {/* General Poster Presentation */}
            </h6>
          </div>
            <p className="absolute top-[148px] montserrat left-[285px] text-6xl w-16 text-center text-green-800">
              <p className="text-base text-gray-600">#result</p>
              {orderGenerator(program.order) || ""}</p>
          
          <div className={`ml-[65px] absolute top-[200px] left-[10px] mt-[45px] flex flex-col`}>
            {result.filter((rank: any) => rank.rank < 3 && rank.rank != 0).map((pro: any,index:number) => (
                <div key={pro.rank} className={`h-[58px] flex items-center gap-2 w-50`}>
                  <p className={`nexa-regular text-3xl text-gray-500/50 tracking-tighter`}>
                    0{pro.rank}
                    </p>
                     <div className={`${image?.theme === "dark" ? "text-gray-900 nexa-regular w-[100px]" : ""} translate-y-[1px]`}>
                    <h6 className="text-[18px] font-semibold w-80 leading-[16px]">
                      {pro.student.toUpperCase()}
                    </h6>
                    <p className="text-[12px] nexa-light w-80 text-gray-500 leading-[13px]">
                      {pro.campus}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </>
      );
    }

    
  


    return null;
  };

  return (
    <Modal close={close} className="w-fit">
      <div className="my-5 p-5 py-2 font-semibold rounded-lg bg-primary-100 text-primary-600">
        frame {frame?.frame}
      </div>
      {loading ? (
        <div className="h-[560.86px] rounded-xl w-[450px] flex items-center justify-center bg-primary-50/50 border border-primary-400">
          <LDRloader />
        </div>
      ) : (
        <div ref={elementRef} className="w-fit">
          <div className="relative w-fit" style={{ aspectRatio: "1/1" }}>
            <img
              src={image?.image}
              alt="Random"
              className="h-[560.86px] w-[450px]"
              onLoad={() => setLoading(false)}
            />
            {renderFrameContent()}
          </div>
        </div>
      )}
      <div className="flex gap-3 mt-5 justify-center">
        <button
          className="flex items-center shadow-lg gap-1 justify-center rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 p-3 px-4 text-white group"
          onClick={handleNextFrame}
        >
          <TbExchange className="group-active:rotate-180 duration-300" />
          Frame
        </button>
        <button
          disabled={downloading || loading}
          onClick={htmlToImageConvert}
          className="flex items-center shadow-lg disabled:opacity-30 disabled:cursor-not-allowed justify-center gap-2 rounded-lg bg-gradient-to-br from-green-400 to-green-600 duration-500 p-3 px-4 text-white"
        >
          {downloading ? "..." : "Download"}
        </button>
      </div>
    </Modal>
  );
}

export default PosterCanvas;
