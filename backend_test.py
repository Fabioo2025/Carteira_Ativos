
import requests
import sys
import json
from datetime import datetime, date
import time
import uuid

class BrazilianInvestmentTrackerTester:
    def __init__(self, base_url):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.created_operations = []

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test the health check endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "api/health",
            200
        )
        if success:
            print(f"Health check response: {response}")
        return success

    def test_get_asset_types(self):
        """Test getting available asset types"""
        success, response = self.run_test(
            "Get Asset Types",
            "GET",
            "api/assets/types",
            200
        )
        if success:
            print(f"Asset types: {response}")
        return success

    def test_create_operation(self, operation_data):
        """Test creating an investment operation"""
        success, response = self.run_test(
            f"Create {operation_data['operation_type']} Operation for {operation_data['asset_code']}",
            "POST",
            "api/operations",
            200,
            data=operation_data
        )
        if success and 'id' in response:
            self.created_operations.append(response['id'])
            print(f"Created operation with ID: {response['id']}")
        return success, response.get('id')

    def test_get_operations(self, asset_code=None, asset_type=None):
        """Test getting operations with optional filters"""
        params = {}
        if asset_code:
            params['asset_code'] = asset_code
        if asset_type:
            params['asset_type'] = asset_type
            
        test_name = "Get All Operations"
        if asset_code:
            test_name += f" for {asset_code}"
        if asset_type:
            test_name += f" of type {asset_type}"
            
        success, response = self.run_test(
            test_name,
            "GET",
            "api/operations",
            200,
            params=params
        )
        if success:
            print(f"Retrieved {len(response)} operations")
        return success, response

    def test_delete_operation(self, operation_id):
        """Test deleting an operation"""
        success, _ = self.run_test(
            f"Delete Operation {operation_id}",
            "DELETE",
            f"api/operations/{operation_id}",
            200
        )
        if success:
            if operation_id in self.created_operations:
                self.created_operations.remove(operation_id)
            print(f"Successfully deleted operation {operation_id}")
        return success

    def test_portfolio_summary(self):
        """Test getting portfolio summary"""
        success, response = self.run_test(
            "Get Portfolio Summary",
            "GET",
            "api/portfolio/summary",
            200
        )
        if success:
            print(f"Portfolio summary: Total invested: {response.get('total_invested')}, " +
                  f"Current value: {response.get('total_current_value')}, " +
                  f"P&L: {response.get('total_profit_loss')}, " +
                  f"P&L %: {response.get('profit_loss_percentage')}")
            print(f"Assets distribution: {response.get('assets_distribution')}")
        return success

    def test_darf_calculation(self, year, month):
        """Test DARF tax calculation for a specific month"""
        success, response = self.run_test(
            f"Calculate DARF for {month}/{year}",
            "GET",
            f"api/darf/calculate/{year}/{month}",
            200
        )
        if success:
            calculations = response.get('calculations', [])
            print(f"DARF calculations: {len(calculations)} tax calculations")
            for calc in calculations:
                print(f"  - {calc.get('asset_type')}: Tax due: {calc.get('tax_due')}, " +
                      f"Exemption applied: {calc.get('exemption_applied')}")
        return success

    def create_sample_operations(self):
        """Create sample operations for testing"""
        today = date.today().isoformat()
        
        # Sample operations for different asset types
        operations = [
            # Buy operations
            {
                "asset_code": "PETR4",
                "asset_type": "acao",
                "trade_category": "swing_trade",
                "operation_type": "compra",
                "quantity": 100,
                "unit_price": 30.50,
                "total_cost": 3050.0,
                "operation_date": today
            },
            {
                "asset_code": "BOVA11",
                "asset_type": "etf",
                "trade_category": "swing_trade",
                "operation_type": "compra",
                "quantity": 50,
                "unit_price": 110.25,
                "total_cost": 5512.50,
                "operation_date": today
            },
            {
                "asset_code": "HGLG11",
                "asset_type": "fii",
                "trade_category": "swing_trade",
                "operation_type": "compra",
                "quantity": 30,
                "unit_price": 180.0,
                "total_cost": 5400.0,
                "operation_date": today
            },
            {
                "asset_code": "BTC",
                "asset_type": "cripto",
                "trade_category": "swing_trade",
                "operation_type": "compra",
                "quantity": 0.1,
                "unit_price": 250000.0,
                "total_cost": 25000.0,
                "operation_date": today
            },
            # Sell operations
            {
                "asset_code": "PETR4",
                "asset_type": "acao",
                "trade_category": "swing_trade",
                "operation_type": "venda",
                "quantity": 50,
                "unit_price": 32.0,
                "total_cost": 1600.0,
                "operation_date": today
            },
            {
                "asset_code": "BTC",
                "asset_type": "cripto",
                "trade_category": "swing_trade",
                "operation_type": "venda",
                "quantity": 0.05,
                "unit_price": 260000.0,
                "total_cost": 13000.0,
                "operation_date": today
            }
        ]
        
        success_count = 0
        for op in operations:
            success, _ = self.test_create_operation(op)
            if success:
                success_count += 1
                
        print(f"\nCreated {success_count}/{len(operations)} sample operations")
        return success_count == len(operations)

    def cleanup(self):
        """Clean up created operations"""
        if not self.created_operations:
            return True
            
        print("\n🧹 Cleaning up created operations...")
        success_count = 0
        for op_id in self.created_operations[:]:
            success = self.test_delete_operation(op_id)
            if success:
                success_count += 1
                
        print(f"Cleaned up {success_count}/{len(self.created_operations)} operations")
        return len(self.created_operations) == 0

def main():
    # Get backend URL from environment or use default
    backend_url = "https://6d3ae8d3-e8ce-46bb-85d0-3205fc5a0b8e.preview.emergentagent.com"
    
    print(f"🚀 Testing Brazilian Investment Tracker API at {backend_url}")
    
    # Setup tester
    tester = BrazilianInvestmentTrackerTester(backend_url)
    
    # Test basic connectivity
    if not tester.test_health_check():
        print("❌ Health check failed, stopping tests")
        return 1
        
    # Test getting asset types
    tester.test_get_asset_types()
    
    # Create sample operations
    if not tester.create_sample_operations():
        print("⚠️ Some operations could not be created")
    
    # Test getting operations
    tester.test_get_operations()
    tester.test_get_operations(asset_code="PETR4")
    tester.test_get_operations(asset_type="cripto")
    
    # Test portfolio summary
    tester.test_portfolio_summary()
    
    # Test DARF calculation
    current_year = datetime.now().year
    current_month = datetime.now().month
    tester.test_darf_calculation(current_year, current_month)
    
    # Clean up
    tester.cleanup()
    
    # Print results
    print(f"\n📊 Tests passed: {tester.tests_passed}/{tester.tests_run}")
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())
