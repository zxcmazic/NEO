import { useEffect, useState } from "react";
import { adminApi } from "../api/client";

interface Cosmetic {
  id: string;
  name: string;
  type: string;
  priceStars: number;
  isActive: boolean;
  salesCount: number;
}

const emptyForm = { name: "", type: "SLOT_SKIN", priceStars: "100" };

export function Cosmetics() {
  const [items, setItems] = useState<Cosmetic[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);

  function refresh() {
    adminApi.listCosmetics().then(setItems);
  }
  useEffect(refresh, []);

  async function handleCreate() {
    await adminApi.createCosmetic({
      name: form.name,
      type: form.type,
      priceStars: Number(form.priceStars),
    });
    setForm(emptyForm);
    setShowForm(false);
    refresh();
  }

  async function toggleActive(item: Cosmetic) {
    await adminApi.updateCosmetic(item.id, { isActive: !item.isActive });
    refresh();
  }

  return (
    <div>
      <div className="page-header">
        <h1>Косметика</h1>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Отмена" : "+ Новый предмет"}
        </button>
      </div>

      <div
        className="card"
        style={{ padding: 12, marginBottom: 20, fontSize: 13, color: "var(--text-secondary)" }}
      >
        Покупка идёт через Telegram Stars (Bot Payments API) — «Продано» считает реальные покупки.
      </div>

      {showForm && (
        <div className="card" style={{ padding: 16, marginBottom: 20 }}>
          <div className="form-grid">
            <div>
              <label>Название</label>
              <input
                style={{ width: "100%" }}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label>Тип</label>
              <select
                style={{ width: "100%" }}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="SLOT_SKIN">Скин слотов</option>
                <option value="TABLE_SKIN">Скин стола</option>
                <option value="AVATAR_FRAME">Рамка аватара</option>
                <option value="WIN_EFFECT">Эффект выигрыша</option>
              </select>
            </div>
            <div>
              <label>Цена, Stars</label>
              <input
                type="number"
                style={{ width: "100%" }}
                value={form.priceStars}
                onChange={(e) => setForm({ ...form, priceStars: e.target.value })}
              />
            </div>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={handleCreate}>
            Создать
          </button>
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>Название</th>
            <th>Тип</th>
            <th>Цена</th>
            <th>Продано</th>
            <th>Статус</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.type}</td>
              <td className="numeric">{item.priceStars} ★</td>
              <td className="numeric">{item.salesCount}</td>
              <td>{item.isActive ? "Активен" : "Скрыт"}</td>
              <td style={{ textAlign: "right" }}>
                <button className="btn btn-ghost" onClick={() => toggleActive(item)}>
                  {item.isActive ? "Скрыть" : "Показать"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
