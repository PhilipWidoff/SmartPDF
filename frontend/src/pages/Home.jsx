import React, { useState, useEffect } from 'react';
import QueryInput from '../components/QueryInput';

function Home() {
  const [backgroundImage, setBackgroundImage] = useState('/Pbackground.png');
  const [selectedPdf, setSelectedPdf] = useState('');
  const [isCustomImage, setIsCustomImage] = useState(false);

  useEffect(() => {
    if (selectedPdf) {
      fetchBackgroundImage(selectedPdf);
    }
  }, [selectedPdf]);

  const fetchBackgroundImage = async (pdfName) => {
    try {
      const response = await fetch(`/api/background-image?pdf=${encodeURIComponent(pdfName)}`, {
        method: 'GET',
      });
      if (response.ok) {
        const imageType = response.headers.get('X-Image-Type');
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        setBackgroundImage(imageUrl);
        setIsCustomImage(imageType === 'custom');
      } else {
        console.error('Failed to fetch background image');
        setBackgroundImage('/Pbackground.png');
        setIsCustomImage(false);
      }
    } catch (error) {
      console.error('Error fetching background image:', error);
      setBackgroundImage('/Pbackground.png');
      setIsCustomImage(false);
    }
  };

  return (
    <div 
      className="flex flex-col min-h-screen w-full h-screen bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      <div className="absolute inset-0 bg-black bg-opacity-50"></div>
      <div className="relative z-10 flex flex-col h-full pt-8">
        <QueryInput onPdfSelect={setSelectedPdf} isCustomImage={isCustomImage} />
      </div>
    </div>
  );
}

export default Home;