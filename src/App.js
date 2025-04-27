import React, { useState, useEffect, useRef } from "react";
import "./styles.css";

const App = () => {
  // State management
  const [currentTime, setCurrentTime] = useState(new Date());
  const [loans, setLoans] = useState(() => {
    const savedLoans = localStorage.getItem("thbLoans");
    return savedLoans ? JSON.parse(savedLoans) : [];
  });
  const [loanForm, setLoanForm] = useState({
    id: null,
    name: "",
    amount: "",
    description: "",
    status: "Pending",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [cryptoPrices, setCryptoPrices] = useState([]);
  const [isLoadingCrypto, setIsLoadingCrypto] = useState(true);
  const ws = useRef(null);

  // Format angka sesuai dengan Indodax
  const formatNumber = (num, isThb = false) => {
    if (isThb) {
      return new Intl.NumberFormat("id-ID", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(num);
    }
    return new Intl.NumberFormat("id-ID").format(num);
  };

  // Save to localStorage when loans change
  useEffect(() => {
    localStorage.setItem("thbLoans", JSON.stringify(loans));
  }, [loans]);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch crypto prices from Indodax API and setup WebSocket
  useEffect(() => {
    const fetchCryptoPrices = async () => {
      setIsLoadingCrypto(true);
      try {
        const pairs = ["btc_idr", "eth_idr", "xrp_idr", "thb_idr"];

        const pricePromises = pairs.map(async (pair) => {
          const response = await fetch(
            `https://indodax.com/api/ticker/${pair}?t=${Date.now()}`
          );
          const data = await response.json();
          return { pair, data };
        });

        const results = await Promise.all(pricePromises);

        const formattedData = results.map(({ pair, data }) => {
          const symbol = pair.split("_")[0].toUpperCase();
          const isThb = symbol === "THB";
          const lastPrice = parseFloat(data.ticker.last);
          const previousPrice = parseFloat(data.ticker.prev_day);
          const change = ((lastPrice - previousPrice) / previousPrice) * 100;

          return {
            symbol,
            last: formatNumber(lastPrice, isThb),
            change: `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`,
            rawChange: change,
          };
        });

        setCryptoPrices(formattedData);
      } catch (error) {
        console.error("Error fetching crypto prices:", error);
      } finally {
        setIsLoadingCrypto(false);
      }
    };

    // Setup WebSocket connection
    const setupWebSocket = () => {
      ws.current = new WebSocket("wss://socket.indodax.com/ws");

      ws.current.onopen = () => {
        ws.current.send(
          JSON.stringify({
            method: "subcribe",
            params: [
              "ticker_btcidr",
              "ticker_ethidr",
              "ticker_xrpidr",
              "ticker_thbidr",
            ],
            id: 1,
          })
        );
      };

      ws.current.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data && data.t && data.t.includes("ticker")) {
          const pair = data.t.replace("ticker_", "").toUpperCase();
          const symbol = pair.split("_")[0];

          setCryptoPrices((prevPrices) =>
            prevPrices.map((item) => {
              if (item.symbol === symbol) {
                const lastPrice = parseFloat(data.c);
                const change =
                  ((lastPrice - item.lastPrice) / item.lastPrice) * 100;
                const isThb = symbol === "THB";

                return {
                  ...item,
                  last: formatNumber(lastPrice, isThb),
                  change: `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`,
                  rawChange: change,
                  lastPrice,
                };
              }
              return item;
            })
          );
        }
      };

      ws.current.onerror = (error) => {
        console.error("WebSocket Error:", error);
        setTimeout(setupWebSocket, 5000);
      };

      ws.current.onclose = () => {
        setTimeout(setupWebSocket, 5000);
      };
    };

    // Initial fetch
    fetchCryptoPrices();
    setupWebSocket();

    // API fallback every 5 seconds
    const interval = setInterval(fetchCryptoPrices, 5000);

    return () => {
      clearInterval(interval);
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setLoanForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!loanForm.name || !loanForm.amount) return;

    setIsLoading(true);

    const newLoan = {
      id: isEditing ? loanForm.id : Date.now(),
      date: new Date().toLocaleDateString("id-ID"),
      time: new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      name: loanForm.name,
      amount: loanForm.amount,
      description: loanForm.description || "-",
      status: loanForm.status,
    };

    setTimeout(() => {
      if (isEditing) {
        setLoans(
          loans.map((loan) => (loan.id === newLoan.id ? newLoan : loan))
        );
      } else {
        setLoans([...loans, newLoan]);
      }

      resetForm();
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
      setIsLoading(false);
    }, 500);
  };

  const resetForm = () => {
    setLoanForm({
      id: null,
      name: "",
      amount: "",
      description: "",
      status: "Pending",
    });
    setIsEditing(false);
  };

  const handleEdit = (loan) => {
    setLoanForm({
      id: loan.id,
      name: loan.name,
      amount: loan.amount,
      description: loan.description === "-" ? "" : loan.description,
      status: loan.status,
    });
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = (id) => {
    if (window.confirm("Yakin ingin menghapus data ini?")) {
      setLoans(loans.filter((loan) => loan.id !== id));
    }
  };

  const handleStatusChange = (id, newStatus) => {
    setLoans((prevLoans) =>
      prevLoans.map((loan) =>
        loan.id === id ? { ...loan, status: newStatus } : loan
      )
    );
  };

  const getChangeColor = (rawChange) => {
    return rawChange >= 0 ? "green" : "red";
  };

  return (
    <div className="container">
      {/* Header Section */}
      <div className="header-section">
        <div className="header-left">
          <h1>AGENT BATH UP</h1>
          <h2>THB/IDR Market Tracker</h2>
        </div>
        <div className="header-right">
          <div className="time-display">
            {currentTime.toLocaleString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </div>
        </div>
      </div>

      {/* Crypto Price Box - Pojok Kanan Atas */}
      <div className="crypto-price-box">
        <h3>Harga Real-time Indodax</h3>
        {isLoadingCrypto ? (
          <div className="loading-crypto">Memuat data...</div>
        ) : (
          <div className="price-grid">
            {cryptoPrices.map((crypto, index) => (
              <div key={index} className="price-item">
                <div className="crypto-symbol">{crypto.symbol}/IDR</div>
                <div className="crypto-price">Rp {crypto.last}</div>
                <div
                  className={`crypto-change ${getChangeColor(
                    crypto.rawChange
                  )}`}
                >
                  {crypto.change}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Loan Application Form */}
      <div className="loan-section">
        <h3>Form Peminjaman Bath Thailand</h3>
        <form onSubmit={handleSubmit} className="loan-form">
          <div className="form-group">
            <label>Nama Lengkap</label>
            <input
              type="text"
              name="name"
              value={loanForm.name}
              onChange={handleInputChange}
              placeholder="Masukkan nama lengkap"
              required
            />
          </div>
          <div className="form-group">
            <label>Jumlah Pinjaman (THB)</label>
            <input
              type="number"
              name="amount"
              value={loanForm.amount}
              onChange={handleInputChange}
              placeholder="Masukkan jumlah"
              required
              min="1"
            />
          </div>
          <div className="form-group">
            <label>Keterangan</label>
            <textarea
              name="description"
              value={loanForm.description}
              onChange={handleInputChange}
              placeholder="Alasan pinjaman"
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="submit-btn" disabled={isLoading}>
              {isLoading
                ? "Menyimpan..."
                : isEditing
                ? "Update Pinjaman"
                : "Ajukan Pinjaman"}
            </button>
            {isEditing && (
              <button type="button" className="cancel-btn" onClick={resetForm}>
                Batal
              </button>
            )}
          </div>
          {submitSuccess && (
            <div className="success-message">
              {isEditing
                ? "✅ Data berhasil diupdate!"
                : "✅ Pinjaman berhasil diajukan!"}
            </div>
          )}
        </form>
      </div>

      {/* Loan Table */}
      <div className="loan-list-section">
        <h3>Daftar Pinjaman ({loans.length})</h3>
        {loans.length > 0 ? (
          <div className="table-responsive">
            <table className="loan-table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Nama</th>
                  <th>Jumlah (THB)</th>
                  <th>Keterangan</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => (
                  <tr
                    key={loan.id}
                    className={`row-${loan.status.toLowerCase()}`}
                  >
                    <td>
                      {loan.date} {loan.time}
                    </td>
                    <td>{loan.name}</td>
                    <td>{loan.amount}</td>
                    <td>{loan.description}</td>
                    <td>
                      <select
                        value={loan.status}
                        onChange={(e) =>
                          handleStatusChange(loan.id, e.target.value)
                        }
                        className="status-select"
                      >
                        <option value="Pending">⏳ Pending</option>
                        <option value="Approved">✅ Approved</option>
                        <option value="Rejected">❌ Rejected</option>
                        <option value="Paid">💰 Paid</option>
                      </select>
                    </td>
                    <td className="actions">
                      <button
                        className="edit-btn"
                        onClick={() => handleEdit(loan)}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="delete-btn"
                        onClick={() => handleDelete(loan.id)}
                      >
                        🗑️ Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="no-data">📭 Belum ada data pinjaman</div>
        )}
      </div>
    </div>
  );
};

export default App;
