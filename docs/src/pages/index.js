import React, { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    window.location.href = 'https://routr.io';
  }, []);

  return null;
}