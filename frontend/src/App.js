import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [operations, setOperations] = useState([]);
  const [portfolioSummary, setPortfolioSummary] = useState(null);
  const [showOperationModal, setShowOperationModal] = useState(false);
  const [darf, setDarf] = useState([]);
  const [darfPreview, setDarfPreview] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Form state for new operation
  const [newOperation, setNewOperation] = useState({
    asset_code: '',
    asset_type: 'acao',
    trade_category: 'swing_trade',
    operation_type: 'compra',
    quantity: '',
    unit_price: '',
    total_cost: '',
    operation_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchOperations();
    fetchPortfolioSummary();
    fetchDarfPreview();
  }, []);

  const fetchOperations = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/operations`);
      setOperations(response.data);
    } catch (error) {
      console.error('Error fetching operations:', error);
    }
  };

  const fetchPortfolioSummary = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/portfolio/summary`);
      setPortfolioSummary(response.data);
    } catch (error) {
      console.error('Error fetching portfolio summary:', error);
    }
  };

  const fetchDarf = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/darf/calculate/${selectedYear}/${selectedMonth}`);
      setDarf(response.data.calculations || []);
    } catch (error) {
      console.error('Error fetching DARF:', error);
    }
  };

  const handleSubmitOperation = async (e) => {
    e.preventDefault();
    try {
      const operationData = {
        ...newOperation,
        quantity: parseFloat(newOperation.quantity),
        unit_price: parseFloat(newOperation.unit_price),
        total_cost: parseFloat(newOperation.total_cost)
      };

      await axios.post(`${API_BASE_URL}/api/operations`, operationData);
      
      // Reset form and close modal
      setNewOperation({
        asset_code: '',
        asset_type: 'acao',
        trade_category: 'swing_trade',
        operation_type: 'compra',
        quantity: '',
        unit_price: '',
        total_cost: '',
        operation_date: new Date().toISOString().split('T')[0]
      });
      setShowOperationModal(false);
      
      // Refresh data
      fetchOperations();
      fetchPortfolioSummary();
    } catch (error) {
      console.error('Error creating operation:', error);
      alert('Erro ao criar operação');
    }
  };

  const deleteOperation = async (operationId) => {
    if (window.confirm('Tem certeza que deseja excluir esta operação?')) {
      try {
        await axios.delete(`${API_BASE_URL}/api/operations/${operationId}`);
        fetchOperations();
        fetchPortfolioSummary();
      } catch (error) {
        console.error('Error deleting operation:', error);
      }
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const getAssetTypeLabel = (type) => {
    const labels = {
      'acao': 'Ação',
      'etf': 'ETF',
      'fii': 'FII',
      'bdr': 'BDR',
      'opcao': 'Opção',
      'cripto': 'Criptoativo'
    };
    return labels[type] || type;
  };

  const getTradeCategoryLabel = (category) => {
    return category === 'swing_trade' ? 'Swing Trade' : 'Day Trade';
  };

  const getOperationTypeLabel = (type) => {
    return type === 'compra' ? 'Compra' : 'Venda';
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-500">Total Investido</h3>
          <p className="text-2xl font-bold text-gray-900">
            {portfolioSummary ? formatCurrency(portfolioSummary.total_invested) : formatCurrency(0)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-500">Valor Atual</h3>
          <p className="text-2xl font-bold text-gray-900">
            {portfolioSummary ? formatCurrency(portfolioSummary.total_current_value) : formatCurrency(0)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-500">Resultado</h3>
          <p className={`text-2xl font-bold ${portfolioSummary && portfolioSummary.total_profit_loss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {portfolioSummary ? formatCurrency(portfolioSummary.total_profit_loss) : formatCurrency(0)}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-sm font-medium text-gray-500">Rentabilidade</h3>
          <p className={`text-2xl font-bold ${portfolioSummary && portfolioSummary.profit_loss_percentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {portfolioSummary ? `${portfolioSummary.profit_loss_percentage.toFixed(2)}%` : '0.00%'}
          </p>
        </div>
      </div>

      {/* Assets Distribution */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Distribuição por Ativo</h3>
        {portfolioSummary && Object.keys(portfolioSummary.assets_distribution).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(portfolioSummary.assets_distribution).map(([asset, value]) => (
              <div key={asset} className="flex justify-between items-center py-2 border-b">
                <span className="font-medium">{asset}</span>
                <span>{formatCurrency(value)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">Nenhum ativo na carteira</p>
        )}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => setShowOperationModal(true)}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );

  const renderOperations = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Histórico de Operações</h2>
        <button
          onClick={() => setShowOperationModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Nova Operação
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ativo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Operação
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantidade
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Preço Unit.
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {operations.map((operation) => (
                <tr key={operation.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {operation.asset_code}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {getAssetTypeLabel(operation.asset_type)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      operation.operation_type === 'compra' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {getOperationTypeLabel(operation.operation_type)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {operation.quantity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatCurrency(operation.unit_price)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {operation.operation_type === 'venda' 
                      ? formatCurrency(operation.quantity * operation.unit_price)
                      : formatCurrency(operation.total_cost)
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(operation.operation_date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button
                      onClick={() => deleteOperation(operation.id)}
                      className="text-red-600 hover:text-red-900 transition-colors"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderDarf = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Cálculo de DARF</h2>
        <div className="flex space-x-4">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {new Date(2024, i).toLocaleDateString('pt-BR', { month: 'long' })}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2"
          >
            {Array.from({ length: 5 }, (_, i) => (
              <option key={2024 + i} value={2024 + i}>
                {2024 + i}
              </option>
            ))}
          </select>
          <button
            onClick={fetchDarf}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Calcular DARF
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">
          DARF - {new Date(selectedYear, selectedMonth - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </h3>
        
        {darf.length > 0 ? (
          <div className="space-y-4">
            {darf.map((calculation, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <span className="text-sm text-gray-500">Tipo de Ativo:</span>
                    <p className="font-medium">{getAssetTypeLabel(calculation.asset_type)}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Total de Vendas:</span>
                    <p className="font-medium">{formatCurrency(calculation.total_sales)}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Lucro Tributável:</span>
                    <p className="font-medium">{formatCurrency(calculation.taxable_profit)}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Alíquota:</span>
                    <p className="font-medium">{(calculation.tax_rate * 100).toFixed(1)}%</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Imposto Devido:</span>
                    <p className="font-medium">{formatCurrency(calculation.tax_due)}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">IR Retido:</span>
                    <p className="font-medium">{formatCurrency(calculation.ir_retained || 0)}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">DARF Líquido:</span>
                    <p className="font-medium text-blue-600">{formatCurrency(calculation.net_tax_due)}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Isenção Aplicada:</span>
                    <p className={`font-medium ${calculation.exemption_applied ? 'text-green-600' : 'text-gray-600'}`}>
                      {calculation.exemption_applied ? 'Sim' : 'Não'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            
            <div className="border-t border-gray-200 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Total DARF a Pagar:</span>
                <span className="text-2xl font-bold text-blue-600">
                  {formatCurrency(darf.reduce((sum, calc) => sum + calc.net_tax_due, 0))}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">Nenhuma operação de venda encontrada para este período.</p>
        )}
      </div>
    </div>
  );

  const renderOperationModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
        <h3 className="text-lg font-semibold mb-4">Nova Operação</h3>
        
        <form onSubmit={handleSubmitOperation} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Código do Ativo
            </label>
            <input
              type="text"
              value={newOperation.asset_code}
              onChange={(e) => setNewOperation({ ...newOperation, asset_code: e.target.value.toUpperCase() })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              placeholder="Ex: PETR4, ITUB4, HASH11"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Ativo
            </label>
            <select
              value={newOperation.asset_type}
              onChange={(e) => setNewOperation({ ...newOperation, asset_type: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="acao">Ação</option>
              <option value="etf">ETF</option>
              <option value="fii">FII</option>
              <option value="bdr">BDR</option>
              <option value="opcao">Opção</option>
              <option value="cripto">Criptoativo</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoria
            </label>
            <select
              value={newOperation.trade_category}
              onChange={(e) => setNewOperation({ ...newOperation, trade_category: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="swing_trade">Swing Trade</option>
              <option value="day_trade">Day Trade</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Operação
            </label>
            <select
              value={newOperation.operation_type}
              onChange={(e) => setNewOperation({ ...newOperation, operation_type: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
            >
              <option value="compra">Compra</option>
              <option value="venda">Venda</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quantidade
              </label>
              <input
                type="number"
                step="0.01"
                value={newOperation.quantity}
                onChange={(e) => setNewOperation({ ...newOperation, quantity: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preço Unitário
              </label>
              <input
                type="number"
                step="0.01"
                value={newOperation.unit_price}
                onChange={(e) => setNewOperation({ ...newOperation, unit_price: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Custo Total (incluindo taxas)
            </label>
            <input
              type="number"
              step="0.01"
              value={newOperation.total_cost}
              onChange={(e) => setNewOperation({ ...newOperation, total_cost: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data da Operação
            </label>
            <input
              type="date"
              value={newOperation.operation_date}
              onChange={(e) => setNewOperation({ ...newOperation, operation_date: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2"
              required
            />
          </div>

          <div className="flex space-x-4 pt-4">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg transition-colors"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={() => setShowOperationModal(false)}
              className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-lg transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">
              📊 Carteira de Investimentos
            </h1>
            <div className="text-sm text-gray-500">
              Calculadora de DARF Brasileira
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: '📊' },
              { id: 'operations', label: 'Operações', icon: '📈' },
              { id: 'darf', label: 'DARF', icon: '🧾' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'operations' && renderOperations()}
        {activeTab === 'darf' && renderDarf()}
      </main>

      {/* Operation Modal */}
      {showOperationModal && renderOperationModal()}
    </div>
  );
};

export default App;