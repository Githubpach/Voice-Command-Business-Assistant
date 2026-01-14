# Voice-Command-Business-Assistant
A voice-first web application that helps small business owners manage sales, expenses, inventory, and profit using **speech instead of typing**. The app supports **mixed English and Chichewa commands**, making it accessible for users with low digital literacy.

---

## Problem Statement

Many small business owners in informal sectors struggle to use traditional digital tools due to:
- Low literacy levels
- Language barriers
- Difficulty typing or navigating complex interfaces  

This project solves that problem by enabling **voice-based business management**, tailored for local use in Malawi.

---

## Solution Overview

The application allows users to:
- Speak commands (e.g., “Ndagulitsa 3 buku pa 500”)
- Automatically process the command on the backend
- Store and retrieve business data
- Receive **spoken feedback** instead of text-only responses

---

## Application Workflow

1. User speaks a command using a microphone  
2. Frontend (React) captures voice using the Web Speech API  
3. Command is sent to the backend via a REST API  
4. Backend (Node.js + Express) parses intent and processes logic  
5. Data is stored/retrieved from the database  
6. Backend returns a JSON response  
7. Frontend provides voice feedback (Text-to-Speech)

---


