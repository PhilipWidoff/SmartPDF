import React from 'react';
import QueryInput from '../components/QueryInput';

function Home() {
  return (
    <div className="flex flex-col min-h-screen items-center 
      justify-center relative w-full h-screen pt-16 
      bg-[url('/Pbackground.png')] bg-cover bg-center bg-no-repeat">
      
      <div className="App bg-transparent">
        <QueryInput />
      </div>
       
    </div>
  );
}

export default Home;
