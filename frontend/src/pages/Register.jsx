export default function Register(){
  async function onSubmit(e){
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    payload.weight_kg = payload.weight_kg ? Number(payload.weight_kg) : null;
    try{ await register(payload); alert("Registered. Please login."); }catch{ alert("Registration failed"); }
  }
  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-2">Register</h2>
      <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <input name="username" placeholder="Username" className="border rounded-lg p-2" required />
        <input name="password" type="password" placeholder="Password (12+ chars)" className="border rounded-lg p-2" required />
        <select name="sex" className="border rounded-lg p-2"><option value="">Sex</option><option>male</option><option>female</option><option>diverse</option></select>
        <select name="fitness_level" className="border rounded-lg p-2"><option value="">Fitness level</option><option>beginner</option><option>intermediate</option><option>advanced</option></select>
        <input name="weight_kg" type="number" step="0.1" placeholder="Weight (kg)" className="border rounded-lg p-2" />
        <input name="age" type="number" min="16" max="100" placeholder="Age" className="border rounded-lg p-2" />
        <div className="md:col-span-2"><button className="bg-green-600 text-white px-4 py-2 rounded-lg">Create account</button></div>
      </form>
    </div>
  );
}