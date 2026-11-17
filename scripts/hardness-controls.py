"""Independently recompute generated balances with Fractions and test tolerant verifier controls."""
import importlib.util
import json
import tempfile
from datetime import date
from decimal import Decimal
from fractions import Fraction
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]


def module(name,file):
    spec=importlib.util.spec_from_file_location(name,file)
    value=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


scenario=module("scenario",ROOT/"scripts/hardness-scenario.py")
verifier=module("verifier",ROOT/"harbor/hardness_verify.py")
F=Fraction


def money(number):
    return scenario.money(Decimal(number.numerator)/Decimal(number.denominator))


campaign=ROOT/"content/campaigns/legal-bo5-20261115/rounds"
specimens=[(level,level+1,None) for level in range(1,7)] + [(level,r,None) for r in range(8,21) for level in range(1,7)]
frozen_records=[]
for folder in sorted(campaign.iterdir()):
    if (folder/"scenario-record.json").exists():
        record=json.loads((folder/"scenario-record.json").read_text())
        specimens.append((record["level"],record["round"],folder))
        frozen_records.append(folder.name)

for level,round_no,frozen_folder in specimens:
    with tempfile.TemporaryDirectory(prefix="legal-bo5-control-") as temp:
        folder=Path(temp)
        dossier,contract,expected,origin=scenario.fictional(folder,[],level,round_no)
        if round_no >= 15:
            assert origin["student_projection"]["policy"]=="contract_and_event_without_researcher_conclusions"
            assert "09:20" in dossier and "13:40" in dossier and "16:10" in dossier
            assert "不是双方认可的事实或法院认定" in dossier
            assert "共同承担的比例只限制辛的范围" not in dossier
            assert "代为清偿的比例也不缩减乙的债务" not in dossier
            assert "不是对甲各担一半" not in dossier
            assert "guarantee_states" not in contract and "third_party_types" not in contract
            assert "状态" in contract["status_values"]
        data=json.loads((folder/"scenario-record.json").read_text())
        if frozen_folder:
            assert data==json.loads((frozen_folder/"scenario-record.json").read_text()),frozen_folder.name
            assert expected==json.loads((frozen_folder/"expected.json").read_text()),frozen_folder.name
        loans=data["loans"]
        initial=F(loans["B"]["original_actual"])
        capital=initial
        last=date(2022,1,12)
        cutoff=date.fromisoformat(data["cutoff"])
        cap=F(data["cap"])
        for bill in loans["B"]["rolls"]:
            now=date.fromisoformat(bill["date"])
            capital*=1+min(F(loans["B"]["rate"]),cap)*F((now-last).days,365)
            last=now
        capital*=1+min(F(loans["B"]["rate"]),cap)*F((cutoff-last).days,365)
        capped=initial*(1+cap*F((cutoff-date(2022,1,12)).days,365))
        b_remaining=min(capital,capped)
        p=F(loans["C"]["actual"])
        interest=F(0)
        fees=F(1680)
        last=date.fromisoformat(loans["C"].get("started_at","2022-02-07"))
        schedule=loans["C"].get("protected_rate_schedule",[{"from":str(last),"rate":"0.114"}])
        def independent_interest(principal,start,end):
            cursor=start
            result=F(0)
            while cursor<end:
                active=[row for row in schedule if date.fromisoformat(row["from"])<=cursor][-1]
                future=[date.fromisoformat(row["from"]) for row in schedule if date.fromisoformat(row["from"])>cursor]
                segment_end=min([end]+future)
                result+=principal*F(active["rate"])*F((segment_end-cursor).days,365)
                cursor=segment_end
            return result
        for payment in loans["C"]["payments"]:
            now=date.fromisoformat(payment["date"])
            interest+=independent_interest(p,last,now)
            remaining=F(payment["amount"])
            parts=[p,fees,interest] if payment["principal_first_agreement"] else [fees,interest,p]
            after=[]
            for part in parts:
                removed=min(part,remaining)
                after.append(part-removed)
                remaining-=removed
            if payment["principal_first_agreement"]:
                p,fees,interest=after
            else:
                fees,interest,p=after
            last=now
        interest+=independent_interest(p,last,cutoff)
        shared=data.get("shared_cutoff_payment")
        if shared:
            # Recompute allocation under the explicitly limited B/C payment scope.
            recipient="B" if round_no>=11 else "C" if round_no>=9 else "B" if level>=3 else "C"
            assert shared["engineering_recipient"]==recipient
            if recipient=="B":
                b_remaining-=F(shared["amount"])
            else:
                remaining=F(shared["amount"])
                balances=[fees,interest,p]
                after=[]
                for balance in balances:
                    removed=min(balance,remaining)
                    after.append(balance-removed)
                    remaining-=removed
                fees,interest,p=after
        assert expected["B_protected_total"]==money(b_remaining)
        if data.get("co_guarantee"):
            share=F(1) if round_no>=13 else F(data["co_guarantee"]["internal_recourse_share"])
            assert expected["B_joint_payment_limit"]==money(b_remaining*share)
        assert expected["C_outstanding_principal"]==money(p)
        assert expected["C_outstanding_interest"]==money(interest)
        assert expected["C_outstanding_expenses"]==money(fees)
        restitution=F(loans["A"]["actual"])-F(loans["A"]["returned"])
        remaining_c=sum(F(money(x)) for x in [p,interest,fees])
        third=data.get("third_party_mechanism")
        if third:
            share=F(third["share"])
            third_limit=F(0) if third["type"]=="guarantee" else F(money(remaining_c*share))
            assert expected["C_third_party_payment_limit"]==money(third_limit)
            if third["type"]=="debt_transfer":
                remaining_c-=third_limit
                assert expected["C_original_borrower_liability"]==money(remaining_c)
        assert expected["borrower_total"]==money(F(money(restitution))+F(money(b_remaining))+remaining_c)
        assert verifier.verify(json.dumps(expected),expected)["passed"]
        assert verifier.verify("```json\n"+json.dumps({"answer":expected})+"\n```",expected)["passed"]
        assert verifier.verify(json.dumps({"answers":expected,"basis":{},"unresolved":{}}),expected)["passed"]
        validity_alias=expected.copy()
        validity_alias["A_valid"]="无效"
        assert verifier.verify(json.dumps(validity_alias),expected)["passed"]
        for key,value in expected.items():
            if not isinstance(value,str):
                continue
            try:
                numeric=Decimal(value)
            except Exception:
                continue
            one_cent=expected.copy()
            one_cent[key]=str(numeric+Decimal("0.01"))
            assert not verifier.verify(json.dumps(one_cent),expected)["passed"],key
            unrounded=expected.copy()
            unrounded[key]=str(numeric+Decimal("0.004"))
            assert verifier.verify(json.dumps(unrounded),expected)["passed"],key
        for key,value in expected.items():
            wrong=expected.copy()
            if isinstance(value,bool):
                wrong[key]=not value
            else:
                try: wrong[key]=str(Decimal(value)+10)
                except Exception: wrong[key]="unsupported_state"
            assert not verifier.verify(json.dumps(wrong),expected)["passed"],key
print(f"6 mechanism levels and {len(frozen_records)} actual round records independently recomputed with Fractions; all value/status mutations rejected; equivalent JSON wrappers accepted")
