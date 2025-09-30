import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { logout } from "../api.js";

export default function Navbar({ authed, onLogout }){
  const [open,setOpen]=useState(false);
  const nav = useNavigate();
  async function doLogout(){ await logout(); onLogout?.(); nav("/"); }
  return (
    <nav className="bg-gradient-to-r from-primary to-secondary h-14 flex items-center px-4 shadow-md relative">
      <div className="text-white font-bold text-lg">FitVibe</div>
      <div className="ml-auto hidden md:flex items-center space-x-6">
        <Link to="/dashboard" className="text-white hover:opacity-90">Dashboard</Link>
        <Link to="/sessions" className="text-white hover:opacity-90">Sessions</Link>
        <Link to="/progress" className="text-white hover:opacity-90">Progress</Link>
        <Link to="/feed" className="text-white hover:opacity-90">Community</Link>
        <Link to="/account" className="text-white hover:opacity-90">Account</Link>
        {authed ? <button onClick={doLogout} className="bg-white/20 text-white px-3 py-1 rounded-lg hover:bg-white/30">Logout</button> : 
        <Link to="/login" className="bg-white text-indigo-700 px-3 py-1 rounded-lg">Login</Link>}
      </div>
      <button className="ml-auto md:hidden text-white" onClick={()=>setOpen(!open)} aria-label="Menu">☰</button>
      {open && (
        <div className="absolute top-14 right-2 bg-white shadow-lg rounded-xl p-3 flex flex-col space-y-2 md:hidden hover:opacity-90">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/sessions">Sessions</Link>
          <Link to="/progress">Progress</Link>
          <Link to="/feed">Community</Link>
          <Link to="/account">Account</Link>
          {authed ? <button onClick={doLogout} className="text-left">Logout</button> : <Link to="/login">Login</Link>}
        </div>
      )}
    </nav>
  );
}
