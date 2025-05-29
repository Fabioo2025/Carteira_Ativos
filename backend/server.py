from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime, date
from decimal import Decimal
import os
from motor.motor_asyncio import AsyncIOMotorClient
import uuid
from enum import Enum

# Initialize FastAPI app
app = FastAPI(title="Brazilian Investment Tracker")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'investment_tracker')

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Enums
class AssetType(str, Enum):
    ACAO = "acao"
    ETF = "etf"
    FII = "fii"
    BDR = "bdr"
    OPCAO = "opcao"
    CRIPTO = "cripto"

class OperationType(str, Enum):
    COMPRA = "compra"
    VENDA = "venda"

class TradeCategory(str, Enum):
    SWING_TRADE = "swing_trade"
    DAY_TRADE = "day_trade"

# Pydantic models
class Operation(BaseModel):
    id: Optional[str] = None
    asset_code: str
    asset_type: AssetType
    trade_category: TradeCategory
    operation_type: OperationType
    quantity: float
    unit_price: float
    total_cost: float  # includes fees, brokerage
    operation_date: date
    created_at: Optional[datetime] = None

class PortfolioSummary(BaseModel):
    total_invested: float
    total_current_value: float
    total_profit_loss: float
    profit_loss_percentage: float
    assets_distribution: Dict[str, float]

class DARFCalculation(BaseModel):
    month: str
    year: int
    asset_type: AssetType
    total_sales: float
    taxable_profit: float
    tax_rate: float
    tax_due: float
    exemption_applied: bool
    ir_retained: float
    net_tax_due: float

class TaxCalculationService:
    """Service to calculate Brazilian taxes according to 2025 regulations"""
    
    @staticmethod
    def calculate_swing_trade_tax(sales_amount: float, profit: float) -> Dict:
        """Calculate tax for swing trade operations (ações, ETFs, BDRs)"""
        # Exemption: sales <= R$ 20,000 per month
        MONTHLY_EXEMPTION = 20000.0
        TAX_RATE = 0.15
        
        if sales_amount <= MONTHLY_EXEMPTION:
            return {
                "tax_rate": 0.0,
                "tax_due": 0.0,
                "exemption_applied": True,
                "ir_retained": 0.0,
                "net_tax_due": 0.0
            }
        
        tax_due = max(0, profit * TAX_RATE)
        return {
            "tax_rate": TAX_RATE,
            "tax_due": tax_due,
            "exemption_applied": False,
            "ir_retained": 0.0,
            "net_tax_due": tax_due
        }
    
    @staticmethod
    def calculate_day_trade_tax(profit: float) -> Dict:
        """Calculate tax for day trade operations"""
        TAX_RATE = 0.20
        IR_RETENTION_RATE = 0.01  # 1% retention ("dedo-duro")
        
        tax_due = max(0, profit * TAX_RATE)
        ir_retained = profit * IR_RETENTION_RATE if profit > 0 else 0
        net_tax_due = max(0, tax_due - ir_retained)
        
        return {
            "tax_rate": TAX_RATE,
            "tax_due": tax_due,
            "exemption_applied": False,
            "ir_retained": ir_retained,
            "net_tax_due": net_tax_due
        }
    
    @staticmethod
    def calculate_fii_tax(profit: float) -> Dict:
        """Calculate tax for FII operations"""
        TAX_RATE = 0.20
        
        tax_due = max(0, profit * TAX_RATE)
        return {
            "tax_rate": TAX_RATE,
            "tax_due": tax_due,
            "exemption_applied": False,
            "ir_retained": 0.0,
            "net_tax_due": tax_due
        }
    
    @staticmethod
    def calculate_crypto_tax(sales_amount: float, profit: float) -> Dict:
        """Calculate progressive tax for cryptocurrency operations"""
        MONTHLY_EXEMPTION = 35000.0
        
        if sales_amount <= MONTHLY_EXEMPTION:
            return {
                "tax_rate": 0.0,
                "tax_due": 0.0,
                "exemption_applied": True,
                "net_tax_due": 0.0
            }
        
        # Progressive tax rates for crypto
        if profit <= 5000000:  # até R$ 5M
            tax_rate = 0.15
        elif profit <= 10000000:  # até R$ 10M
            tax_rate = 0.175
        elif profit <= 30000000:  # até R$ 30M
            tax_rate = 0.20
        else:  # acima de R$ 30M
            tax_rate = 0.225
        
        tax_due = max(0, profit * tax_rate)
        return {
            "tax_rate": tax_rate,
            "tax_due": tax_due,
            "exemption_applied": False,
            "net_tax_due": tax_due
        }

class PortfolioService:
    """Service to calculate portfolio metrics and cost basis"""
    
    @staticmethod
    async def calculate_cost_basis(asset_code: str, operations: List[Dict]) -> Dict:
        """Calculate average cost basis for an asset using FIFO method"""
        buy_operations = [op for op in operations if op['operation_type'] == 'compra']
        sell_operations = [op for op in operations if op['operation_type'] == 'venda']
        
        # Sort by date
        buy_operations.sort(key=lambda x: x['operation_date'])
        sell_operations.sort(key=lambda x: x['operation_date'])
        
        total_quantity = 0
        total_cost = 0
        realized_profit = 0
        
        # Calculate purchases
        for buy_op in buy_operations:
            total_quantity += buy_op['quantity']
            total_cost += buy_op['total_cost']
        
        average_cost = total_cost / total_quantity if total_quantity > 0 else 0
        
        # Calculate sales and realized profit
        remaining_quantity = total_quantity
        for sell_op in sell_operations:
            sell_quantity = sell_op['quantity']
            sell_value = sell_op['quantity'] * sell_op['unit_price']
            cost_basis = sell_quantity * average_cost
            realized_profit += sell_value - cost_basis
            remaining_quantity -= sell_quantity
        
        current_position_value = remaining_quantity * average_cost
        
        return {
            "asset_code": asset_code,
            "total_quantity": remaining_quantity,
            "average_cost": average_cost,
            "current_position_value": current_position_value,
            "realized_profit": realized_profit
        }

# API Routes
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "Brazilian Investment Tracker"}

@app.post("/api/operations")
async def create_operation(operation: Operation):
    """Create a new investment operation"""
    operation.id = str(uuid.uuid4())
    operation.created_at = datetime.now()
    
    operation_dict = operation.dict()
    operation_dict['operation_date'] = operation.operation_date.isoformat()
    operation_dict['created_at'] = operation.created_at.isoformat()
    
    result = await db.operations.insert_one(operation_dict)
    return {"id": operation.id, "message": "Operation created successfully"}

@app.get("/api/operations")
async def get_operations(asset_code: Optional[str] = None, asset_type: Optional[AssetType] = None):
    """Get all operations with optional filters"""
    query = {}
    if asset_code:
        query["asset_code"] = asset_code
    if asset_type:
        query["asset_type"] = asset_type
    
    operations = await db.operations.find(query).to_list(1000)
    
    # Convert MongoDB documents to serializable format
    for operation in operations:
        if '_id' in operation:
            del operation['_id']  # Remove MongoDB ObjectId
    
    return operations

@app.delete("/api/operations/{operation_id}")
async def delete_operation(operation_id: str):
    """Delete an operation"""
    result = await db.operations.delete_one({"id": operation_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Operation not found")
    return {"message": "Operation deleted successfully"}

@app.get("/api/portfolio/summary")
async def get_portfolio_summary():
    """Get portfolio summary with total invested, current value, and P&L"""
    operations = await db.operations.find().to_list(1000)
    
    if not operations:
        return PortfolioSummary(
            total_invested=0,
            total_current_value=0,
            total_profit_loss=0,
            profit_loss_percentage=0,
            assets_distribution={}
        )
    
    # Group operations by asset
    assets = {}
    total_invested = 0
    total_realized_profit = 0
    
    for op in operations:
        asset_code = op['asset_code']
        if asset_code not in assets:
            assets[asset_code] = []
        assets[asset_code].append(op)
        
        if op['operation_type'] == 'compra':
            total_invested += op['total_cost']
    
    # Calculate current positions and realized profits
    assets_distribution = {}
    for asset_code, asset_operations in assets.items():
        cost_basis = await PortfolioService.calculate_cost_basis(asset_code, asset_operations)
        total_realized_profit += cost_basis['realized_profit']
        
        if cost_basis['total_quantity'] > 0:
            assets_distribution[asset_code] = cost_basis['current_position_value']
    
    total_current_value = sum(assets_distribution.values())
    total_profit_loss = total_realized_profit + (total_current_value - total_invested)
    profit_loss_percentage = (total_profit_loss / total_invested * 100) if total_invested > 0 else 0
    
    return PortfolioSummary(
        total_invested=total_invested,
        total_current_value=total_current_value,
        total_profit_loss=total_profit_loss,
        profit_loss_percentage=profit_loss_percentage,
        assets_distribution=assets_distribution
    )

@app.get("/api/darf/calculate/{year}/{month}")
async def calculate_darf(year: int, month: int):
    """Calculate DARF tax for a specific month"""
    # Get operations for the specified month
    start_date = f"{year}-{month:02d}-01"
    if month == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{month + 1:02d}-01"
    
    operations = await db.operations.find({
        "operation_date": {"$gte": start_date, "$lt": end_date},
        "operation_type": "venda"
    }).to_list(1000)
    
    if not operations:
        return {"message": "No sales operations found for this month", "calculations": []}
    
    # Group by asset type and trade category
    grouped_sales = {}
    for op in operations:
        key = f"{op['asset_type']}_{op['trade_category']}"
        if key not in grouped_sales:
            grouped_sales[key] = {
                "operations": [],
                "total_sales": 0,
                "total_profit": 0
            }
        grouped_sales[key]["operations"].append(op)
        grouped_sales[key]["total_sales"] += op['quantity'] * op['unit_price']
    
    # Calculate profit for each group
    darf_calculations = []
    for key, data in grouped_sales.items():
        # Handle key splitting more safely
        key_parts = key.split('_')
        if len(key_parts) >= 2:
            asset_type = key_parts[0]
            trade_category = '_'.join(key_parts[1:])  # Join remaining parts for 'swing_trade'
        else:
            continue  # Skip malformed keys
        
        # Calculate profit (simplified - would need cost basis calculation)
        total_profit = data["total_sales"] * 0.1  # Simplified 10% profit for demo
        
        # Apply tax rules
        tax_calc = {}
        if trade_category == "day_trade":
            tax_calc = TaxCalculationService.calculate_day_trade_tax(total_profit)
        elif asset_type == "cripto":
            tax_calc = TaxCalculationService.calculate_crypto_tax(data["total_sales"], total_profit)
        elif asset_type == "fii":
            tax_calc = TaxCalculationService.calculate_fii_tax(total_profit)
        else:  # swing trade for ações, ETFs, BDRs
            tax_calc = TaxCalculationService.calculate_swing_trade_tax(data["total_sales"], total_profit)
        
        # Ensure ir_retained is always present
        if 'ir_retained' not in tax_calc:
            tax_calc['ir_retained'] = 0.0
        
        darf_calc = DARFCalculation(
            month=f"{year}-{month:02d}",
            year=year,
            asset_type=AssetType(asset_type),
            total_sales=data["total_sales"],
            taxable_profit=total_profit,
            **tax_calc
        )
        darf_calculations.append(darf_calc)
    
    return {"calculations": darf_calculations}

@app.get("/api/assets/types")
async def get_asset_types():
    """Get available asset types"""
    return {
        "asset_types": [e.value for e in AssetType],
        "trade_categories": [e.value for e in TradeCategory],
        "operation_types": [e.value for e in OperationType]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)