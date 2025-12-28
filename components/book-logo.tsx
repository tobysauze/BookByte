import React from "react";

interface BookLogoProps {
  className?: string;
}

export function BookLogo({ className = "h-4 w-4" }: BookLogoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Book body - blue rectangle with rounded corners */}
      <rect
        x="2"
        y="3"
        width="20"
        height="18"
        rx="3"
        ry="3"
        fill="#3B82F6"
      />
      
      {/* Bite mark - simple white shape on the right side */}
      <path
        d="M18 6C18.5 6.5 19 7.5 19 8.5C19 9.5 18.5 10.5 18 11C17.5 11.5 17 12.5 17 13.5C17 14.5 17.5 15.5 18 16C18.5 16.5 19 17.5 19 18.5C19 19.5 18.5 20.5 18 21H22V6H18Z"
        fill="white"
      />
      
      {/* Book spine/pages detail - thin white line at bottom */}
      <rect
        x="2"
        y="19"
        width="20"
        height="2"
        fill="white"
      />
    </svg>
  );
}
