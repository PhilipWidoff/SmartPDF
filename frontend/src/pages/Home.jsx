import React from 'react';
import QueryInput from '../components/QueryInput';

function Home() {
  return (
    <div className="flex flex-col min-h-screen items-center 
    justify-center relative w-full h-screen pt-16 bg-neutral-950 
    bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]">
      
      <div className="App bg-transparent">
        <h1 className="text-3xl font-bold mb-5 text-center text-gray-200">PDF Query Interface</h1>
        <QueryInput />
      </div>
       
    </div>
  );
}

export default Home;
