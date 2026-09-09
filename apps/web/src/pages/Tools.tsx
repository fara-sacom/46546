import { useEffect, useState } from "react";
import { api } from "../api";

export default function Tools() {
  const [tools, setTools] = useState<any[]>([]);

  useEffect(() => {
    api.tools().then((r) => setTools(r.tools));
  }, []);

  const grouped = tools.reduce<Record<string, any[]>>((acc, t) => {
    (acc[t.integration] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div>
      <h2>الأدوات المتاحة للوكيل</h2>
      {Object.entries(grouped).map(([integration, list]) => (
        <div className="panel" key={integration}>
          <h3 style={{ marginTop: 0 }}>{integration}</h3>
          <table>
            <thead>
              <tr>
                <th>الأداة</th>
                <th>المستوى</th>
                <th>الوصف</th>
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td><span className={`badge ${t.tier}`}>{t.tier}</span></td>
                  <td>{t.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
