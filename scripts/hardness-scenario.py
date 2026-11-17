"""Deterministic, explicitly fictional legal-financial dossiers and Decimal references."""
import argparse
import hashlib
import json
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP, getcontext
from pathlib import Path

getcontext().prec = 36
ROOT = Path(__file__).resolve().parents[1]
CAMPAIGN = ROOT / "content/campaigns/legal-bo5-20261115"
D = Decimal


def money(n):
    return str(D(n).quantize(D("0.01"), rounding=ROUND_HALF_UP))


def digest(text):
    return hashlib.sha256(text.encode()).hexdigest()


def accrued(principal, start, end, schedule):
    boundaries = [start] + [date.fromisoformat(row["from"]) for row in schedule if start < date.fromisoformat(row["from"]) < end] + [end]
    total = D(0)
    for left, right in zip(boundaries, boundaries[1:]):
        rate = D(next(row["rate"] for row in reversed(schedule) if date.fromisoformat(row["from"]) <= left))
        total += principal * rate * D((right-left).days) / 365
    return total


def save(folder, name, obj):
    text = obj if isinstance(obj, str) else json.dumps(obj, ensure_ascii=False, indent=2) + "\n"
    (folder / name).write_text(text)


def repair_unconsumed_reference(folder):
    if folder.name != "14":
        return
    file = folder/"engineering-reference.json"
    original = file.read_text()
    reference = json.loads(original)
    before = reference["proof"]["shared_cutoff_payment"]["basis"]
    if "; later S14" not in before:
        return
    ledger = json.loads((CAMPAIGN/"requests.json").read_text())
    assert not (folder/"frozen.json").exists(), "Do not repair a frozen reference"
    assert not any(row["round"]=="14" and row["stage"].startswith(("P4","P6","Bo5","Confirm")) for row in ledger), "Reference already consumed"
    archive = folder/"engineering-reference-v1.json"
    assert not archive.exists(), "Do not overwrite original reference history"
    archive.write_text(original)
    reference["proof"]["shared_cutoff_payment"]["basis"] = before.split("; later S14")[0]
    reference["reference_repairs"] = [{"basis":"rounds/13/stage-P6.json","before_sha256":digest(original),"original_artifact":archive.name,"changed_fields":["proof.shared_cutoff_payment.basis"],"original_value":before,"reason":"S14 does not exist in round 14; remove the phantom future event before P4 receives this reference.","student_inputs_changed":False,"expected_answers_changed":False,"prior_reference_consumers":[]}]
    save(folder,"engineering-reference.json",reference)
    print("Round 14 reference locator repaired before P4; original retained; no student or answer changes.",flush=True)


def authorities():
    target = CAMPAIGN / "authorities.json"
    if target.exists():
        return json.loads(target.read_text())
    old = json.loads((ROOT / "content/runs/legal-harbor-001/authorities.json").read_text())
    rows = [r for r in old if r["source_id"] != "copyright-2020"]
    specs = {
        "civil-code-2020": [
            (560, "第五百六十条", "第五百六十一条"),
            (561, "第五百六十一条", "第五百六十二条"),
            (670, "第六百七十条", "第六百七十一条"),
            (679, "第六百七十九条", "第六百八十条"),
            (680, "第六百八十条", "第十三章"),
            (682, "第六百八十二条", "第六百八十三条"),
            (686, "第六百八十六条", "第六百八十七条"),
            (687, "第六百八十七条", "第六百八十八条"),
            (688, "第六百八十八条", "第六百八十九条"),
            (691, "第六百九十一条", "第六百九十二条"),
            (692, "第六百九十二条", "第六百九十三条"),
            (693, "第六百九十三条", "第六百九十四条"),
            (695, "第六百九十五条", "第六百九十六条"),
        ],
        "lending-2020-12": [
            (24, "第二十四条", "第二十五条"),
            (25, "第二十五条", "第二十六条"),
            (26, "第二十六条", "第二十七条"),
            (27, "第二十七条", "第二十八条"),
            (28, "第二十八条", "第二十九条"),
            (29, "第二十九条", "第三十条"),
        ],
    }
    for source, entries in specs.items():
        text = (ROOT / ".local/pilot-laws" / f"{source}.txt").read_bytes().decode("utf-8")
        meta = next(r for r in old if r["source_id"] == source)
        assert digest(text) == meta["textSha256"], "Frozen authority text changed"
        for article, start, end in entries:
            i = text.index(start)
            j = text.index(end, i + len(start))
            excerpt = text[i:j].strip()
            rows.append({"source_id": source, "provision": str(article), "quote": excerpt,
                         "url": meta["url"], "version": meta["version"],
                         "effective_from": meta["effective_from"], "retrievedAt": meta["retrievedAt"],
                         "full_text_sha256": digest(text), "excerpt_sha256": digest(excerpt),
                         "locator": {"start": i, "end": j, "index_unit": "Python Unicode code points"},
                         "verification": "exact_excerpt_from_frozen_official_text"})
    save(CAMPAIGN, "authorities.json", rows)
    return rows


def original(folder, laws):
    files = json.loads((ROOT / "content/runs/legal-harbor-001/student-files.json").read_text())
    dossier = "# 原案脱敏材料：无解题脚手架版本\n\n不是完整卷宗。原判理由和主文不提供。\n\n" + files["claims.txt"] + "\n\n" + files["findings.txt"]
    dossier += "\n\n范围：按原告关于追加交付用于退还预扣款的陈述这一限定前提，计算同一借贷关系的返还范围；该前提不代表独立银行来源追踪。实际利息收付无原始流水，不要求判定真实利息。\n"
    expected = {"restitution": "524100.00", "unadvanced_arithmetic": "19900.00", "interest_statement_gap": "2000.00",
                "loan_valid": False, "additional_origin_independently_traced": False,
                "defendant_substantive_admission": False}
    contract = {"fields": {"restitution": "限定前提下可返还财产数额", "unadvanced_arithmetic": "该口径算术未交付余额",
                           "interest_statement_gap": "余额与净利息陈述差异绝对值", "loan_valid": "合同是否有效",
                           "additional_origin_independently_traced": "是否已独立追踪追加款来源", "defendant_substantive_admission": "是否已建立实体自认"},
                "money": "数字或十进制金额字符串均可，人民币元，最终四舍五入至分", "basis": "简短事实、法律与算式说明，不要求内部思维链"}
    save(folder, "engineering-reference.json", {"answer": expected, "proof": ["502000+750+1350+20000=524100", "42000-22100=19900", "abs(21900-19900)=2000"], "expert_review": False})
    return dossier, contract, expected, {"kind": "source_preserving", "source_case_id": "cn-shanghai-minhang-2023-civil-first-23060", "new_scenario": False, "changes": ["删除金额角色列表和逐项解题指令，不删除所需原文和限定任务前提"]}


def fictional(folder, laws, level, round_no):
    # Three linked debts remain fixed; complexity comes from legal state transitions, not extra parties.
    cap = D("0.148")
    original_b = D(180000 + 370 * round_no)
    paper_b = original_b + D(12000 + 29 * round_no)
    original_c = D(220000 + 410 * round_no)
    cutoff = date(2023, 8, 1)
    b_start = date(2022, 1, 12)
    rolls = [date(2022, 7, 6), date(2023, 1, 9)]
    if level >= 4:
        rolls.insert(1, date(2022, 10, 17))
    b_base, last, nominal_base = original_b, b_start, paper_b
    proof_b, bills = [], []
    rate_b = D("0.22") if level >= 3 and round_no < 10 else D("0.132")
    for i, day in enumerate(rolls):
        days = (day - last).days
        prior = b_base
        b_base += b_base * min(rate_b, cap) * D(days) / 365
        nominal_base += nominal_base * rate_b * D(days) / 365
        proof_b.append({"period_start": str(last), "period_end": str(day), "days": days,
                        "lawful_base": str(prior), "protected_annual_rate": str(min(rate_b, cap)), "lawful_rollover_base": str(b_base)})
        bills.append({"id": f"B-{i+1}", "date": str(day), "face_value": money(nominal_base), "new_cash": "0.00"})
        last = day
    terminal_contract = b_base + b_base * min(rate_b, cap) * D((cutoff-last).days) / 365
    terminal_cap = original_b + original_b * cap * D((cutoff-b_start).days) / 365
    b_total = min(terminal_contract, terminal_cap)
    b_interest = b_total - original_b
    b_guard = "expired" if level >= 3 else "joint"
    if round_no >= 9:
        b_guard = "joint"
    if round_no >= 11:
        b_guard = "expired"
    if round_no >= 12:
        b_guard = "joint_limited_due_lost_recourse"
    if round_no >= 13:
        b_guard = "joint"

    c_start = date(2019 if round_no >= 11 else 2022, 2, 7)
    c_maturity = date(2022, 12, 15)
    c_cost = D("1680")
    c_principal, c_interest, c_last = original_c, D(0), c_start
    rate_c = D("0.114")
    c_schedule = [{"from":str(c_start),"rate":str(rate_c)}]
    if round_no >= 11:
        rate_c = D("0.235")
        c_schedule = [{"from":str(c_start),"rate":"0.235"},{"from":"2020-08-20","rate":"0.130" if round_no>=13 else "0.142"}]
    payment_days = [date(2022, 4, 18), date(2022, 8, 23), date(2022, 11, 14), date(2023, 2, 21)]
    if level >= 5:
        payment_days += [date(2023, 4, 11), date(2023, 6, 6)]
    if round_no >= 11:
        payment_days = [date(2019,4,18),date(2019,8,23),date(2020,2,14),date(2020,9,21),date(2021,4,11),date(2022,6,6),date(2023,7,6)]
    payments, proof_c = [], []
    override_index = 1 if level >= 2 else -1
    for index, day in enumerate(payment_days):
        days = (day-c_last).days
        c_interest += accrued(c_principal,c_last,day,c_schedule)
        amount = D((25000 if round_no >= 11 else 9800) + 1731 * index + 13 * round_no)
        before = {"principal": str(c_principal), "interest": str(c_interest), "expenses": str(c_cost)}
        rest = amount
        order = ["principal", "expenses", "interest"] if index == override_index else ["expenses", "interest", "principal"]
        values = {"principal": c_principal, "interest": c_interest, "expenses": c_cost}
        allocation = {}
        for key in order:
            used = min(rest, values[key])
            values[key] -= used
            rest -= used
            allocation[key] = str(used)
        c_principal, c_interest, c_cost = values["principal"], values["interest"], values["expenses"]
        payments.append({"id": f"T-{index+1:02}", "date": str(day), "amount": money(amount), "debt": "C", "status": "settled", "principal_first_agreement": index == override_index})
        proof_c.append({"date": str(day), "days": days, "before": before, "allocation": allocation, "after": {k: str(v) for k,v in values.items()}})
        c_last = day
    c_interest += accrued(c_principal,c_last,cutoff,c_schedule)
    c_guard = "general_preserved_not_yet_enforceable" if level >= 4 else "expired"
    if round_no >= 9:
        c_guard = "expired"
    if round_no >= 11:
        c_guard = "general_preserved_not_yet_enforceable"
    a_actual = D(142800 + 17 * round_no)
    a_returns = D(19870 + 23 * round_no)
    a_remaining = a_actual-a_returns
    shared_payment = None
    if round_no >= 8:
        # A cutoff-day payment couples guarantee preservation to debt allocation.
        amount = D("25000")
        recipient = "B" if round_no>=13 or b_guard in {"expired","joint_limited_due_lost_recourse"} else "C"
        before_shared = {"B": str(b_total), "C_principal": str(c_principal), "C_interest": str(c_interest), "C_expenses": str(c_cost)}
        if recipient == "B":
            b_total -= amount
        else:
            remaining = amount
            for key in ["expenses", "interest", "principal"]:
                balance = {"expenses": c_cost, "interest": c_interest, "principal": c_principal}[key]
                used = min(remaining, balance)
                remaining -= used
                if key == "expenses":
                    c_cost -= used
                elif key == "interest":
                    c_interest -= used
                else:
                    c_principal -= used
        shared_payment = {"id": "SP-01", "date": str(cutoff), "amount": money(amount), "eligible_debts": ["B", "C"],
                          "engineering_recipient": recipient, "before": before_shared,
                          "basis": "SP agreement: both debts fully secured at payment time; current enforceable annual rates B13.2% > C13.0%; later S14 does not retroactively change this allocation" if round_no>=13 else "civil-code-2020:560; B has only half-debt enforceable security after lost-recourse reduction, C has full preserved general security; B has less security" if round_no>=12 else "civil-code-2020:560; expired guarantee provides no security, preserved general guarantee remains security despite prior-action defense; if both expire, B has the heavier interest burden"}
    expected = {"A_valid": False, "A_restitution": money(a_remaining), "A_guarantee": "invalid_accessory",
                "B_initial_principal": money(original_b), "B_protected_total": money(b_total), "B_guarantee": b_guard,
                "C_outstanding_principal": money(c_principal), "C_outstanding_interest": money(c_interest), "C_outstanding_expenses": money(c_cost), "C_guarantee": c_guard,
                "borrower_total": money(a_remaining + D(money(b_total)) + D(money(c_principal)) + D(money(c_interest)) + D(money(c_cost)))}
    if round_no >= 12:
        expected.update({"B_second_guarantee":"joint" if round_no>=14 else "expired","B_joint_payment_limit":money(b_total if round_no>=13 else b_total/D(2))})
    if round_no >= 15:
        c_total = D(money(c_principal))+D(money(c_interest))+D(money(c_cost))
        is_guarantee = round_no in {16,18}
        is_transfer = round_no >= 19
        fraction = D("0.5") if round_no in {17,18,20} else D(1)
        third_limit = D(0) if is_guarantee else D(money(c_total*fraction))
        expected.update({"C_third_party_type":"debt_transfer" if is_transfer else "guarantee" if is_guarantee else "debt_joining", "C_third_party_payment_limit":money(third_limit)})
        if is_transfer:
            original_liability = c_total-third_limit
            expected["C_original_borrower_liability"] = money(original_liability)
            expected["borrower_total"] = money(a_remaining+D(money(b_total))+original_liability)
            if round_no==19:
                expected["C_guarantee"] = "released_due_debt_transfer"
    header = "# 虚构衍生案件：三笔借款及保证责任\n\n这是法律数据合成研究构造的闭卷情景，不是真实诉讼、证据或判决。下述各份资料真实性已由双方认可，除明确写作单方主张外，相关事实无争议。不存在未列明付款、其他无效事由、损失赔偿或其他法律例外。全部主体为有完全行为能力的自然人。案件于2023-08-01新受理，结算截至该日，不计当日利息。\n\n"
    sections = [
        ("S01", f"甲是三份合同的出借人，乙是三份合同的借款人。A于2022-03-11签订，甲把为个人消费用途向银行套取的信贷资金转给乙，银行追踪与双方陈述已证实该来源。A票面160000元，其中实际到达乙账户{money(a_actual)}元。乙事先不知银行来源，利率仅6%，这两事实均无争议。A约定由丁作连带保证。"),
        ("S02", f"A付款核对协议载明：乙此前共返给甲{money(a_returns)}元；如A被认定无效，双方同意在清算中全部作为已返还财产冲抵，不主张其他无效后赔偿或抵扣。甲最终仅请求剩余实际交付财产返还；未交付的票面差额不另请求。A同一笔交付另有收据，不是追加款。"),
        ("S03", f"B资金为甲合法自有资金。B最初借据日期{b_start}，票面{money(paper_b)}元；付款凭证和补充确认显示票面中{money(paper_b-original_b)}元在放款当时直接作为预扣利息留在甲账户，乙于{b_start}实际收到{money(original_b)}元，当日起息，合同也于该日成立。年利率{rate_b*100}%。双方承认合同成立时一年期LPR为3.70%；这里的报价是虚构题设已确定的事实，不冒充对现实LPR的查询。"),
        ("S04", "B双方随后结算前期本息，把尚未支付的利息写进新借据；均没有新现金交付。所有新借据仍按同一年利率、相同最初合同成立时LPR约定，既没有债务更新另起独立合同，也没有新增独立费用。逐次结算从上次结算日起算，日数为实际自然日、年基数365。保留全部计算精度，只在最终每个输出金额上四舍五入到分；纸面数是当事人名义记账，未经法定利率与本金审查。B从未另行还款。"),
        ("S05", "B借据归档：\n" + "\n".join(f"{x['id']}，{x['date']}，纸面本金{x['face_value']}元，新增交付{x['new_cash']}元。" for x in bills)),
        ("S06", f"B原履行期限届满日2023-01-12，戊于2022-01-12书面与甲约定连带责任保证，未约定保证期间；范围包括原B关系按法定限额清算的全部本息及依法允许的结息部分，戊已书面同意该结息机制。甲乙后于2022-12-28把履行期限改为2023-06-30，唯该展期戊没有书面同意；甲首次向戊要求承担保证责任并到达戊的日期是{'2023-07-18' if level>=3 else '2023-07-05'}，此前未要求其承担责任。甲在本次最终请求中主张B全部可保护本息（包括合法的前期结算利息），不另叠加纸面本金或预扣利息。"),
        ("S07", f"C自有资金借款，{c_start}实际支付{money(original_c)}元，没有预扣。期限至{c_maturity}，约定年利率11.40%，逾期仍11.40%，合同成立时一年期LPR题设已认可为3.70%。实现债权的合理费用1680元已经发生且双方认可依法可收取，在所有下列付款之前已到期。不存在违约金或其他费用。利息以当时未清偿本金、实际自然日/365单利累计，不对未付利息另计息。每次付款当日不对被偿还本金继续计息；未清偿部分继续计息到截日。"),
        ("S08", "C原始结算流水主表：\n" + "\n".join(f"{x['id']} / {x['date']} / 乙向甲付款{x['amount']}元 / 银行已结算 / 乙指定偿还C号债务。" for x in payments)),
        ("S09", f"C双方仅对{payments[override_index]['id']}付款另签书面清偿协议：这一笔先抵本金，再抵费用，最后抵利息。其他各笔没有关于本金、利息、费用顺序的另行约定。单方附言如‘还本金’未获甲认可，不构成双方另行顺序约定。" if override_index >= 0 else "C所有各笔均无另行清偿顺序约定。"),
        ("S10", f"C还有一个未写保证方式且未约定保证期间的保证合同，保证人为己。甲于2023-05-08向己发送要求支付的短信。甲另于{'2023-06-08' if level>=4 else '2023-06-20'}对乙提起关于C的独立诉讼，该日期为诉讼提出并有效受理之日；本题视保证权利在该日行使，无送达延迟争议。截至截日该前诉未审判，乙有可供执行财产，无民法典第687条各项例外，己未放弃先诉抗辩。前诉无已执行款。"),
        ("S11", "主表之外的资料：\n" + f"乙个人导出的银行截图再列{payments[0]['id']}，金额{payments[0]['amount']}元，与主表同一银行交易号；甲手写收据也再次列同一交易号。\n" + f"另有2023-03-07指令X-01金额{payments[1]['amount']}元，状态为失败未结算，乙称已点击提交；银行与双方均确认没有实际到账。\nA票面、收据与银行实际到账的表述指同一交付。B各次新借据是原关系结算而非新现金。以上文件未新增与主表不同的实际支付。"),
        ("S12", "最终诉请：甲对乙请求A未返还实际财产、B全部可保护本息、C未偿本金和合法利息及未偿费用，并要求丁、戊、己依其保证合同立即支付相应债务。请区分保证合同无效、保证期间届满免除、期间内有效保全但尚可行使先诉抗辩、可请求连带支付这四种状态；不请求计算保证合同无效后的过错赔偿，不能将其填作连带保证债务。各输出分项最终取分后再相加形成总额，不作不同债务交叉冲抵。"),
    ]
    if shared_payment:
        sections.append(("S13", "截日银行回单SP-01：2023-08-01乙另向甲实际付款25000.00元，已经结算到账。双方书面约定该款只用于清偿B、C两笔借款，不用于A返还债务；乙未在B、C之间作具体指定，双方也没有在二者之间选择债务或约定抵充顺序。B、C均无各自保证合同以外的抵押、质押或其他担保。最终诉请所核对的是本回单到账后的剩余余额，计息仍不计2023-08-01当日。SP-01与T系列及X-01均为不同银行交易号。"))
    if round_no >= 6:
        # Keep the transaction evidence, not the researcher's classification of it.
        replacements = {
            "S02": f"A付款核对协议载明：乙此前共返给甲{money(a_returns)}元；如A被认定无效，双方同意在清算中全部作为已返还财产冲抵，不主张其他无效后赔偿或抵扣。甲最终仅请求剩余实际交付财产返还；未交付的票面差额不另请求。档案中另有同日收据，其银行交易号与S01到账记录一致。",
            "S04": "B甲乙双方签署的结算协议：每一归档日确认上一期尚未支付的本息并在新借据上记账，各归档日的新增银行转账均为0元。双方不另成立债务更新合同，各期沿用最初借据约定的利率与合同成立时LPR。逐次结算从上次结算日起算，日数为实际自然日、年基数365。保留全部计算精度，仅在最终各输出金额上四舍五入到分。B档案未记载其他还款。",
            "S11": "其他归档记录：\n" + f"乙导出的银行截图：{payments[0]['id']}，{payments[0]['amount']}元；甲收据：{payments[0]['id']}，{payments[0]['amount']}元。两份记录的银行交易号均与S08首行相同。\n" + f"乙操作记录：2023-03-07提交X-01付款指令，{payments[1]['amount']}元，备注偿还C。银行结果通知：X-01未执行，已撤销付款指令，未向甲账户记入该金额。\n各记录真实性均获双方认可，乙另称自己点击提交的操作已完成。",
            "S12": "最终诉请：甲对乙请求A未返还实际财产、B全部可保护本息的未偿余额、C未偿本金和合法利息及未偿费用，并要求丁、戊、己依其保证合同立即支付相应债务。不请求计算保证合同无效后的过错赔偿。各输出分项最终取分后再相加形成总额。",
        }
        if override_index >= 0:
            replacements["S09"] = f"C原始文件：甲乙双方签署的结算总则约定按法律规定办理清偿。{payments[override_index]['date']}双方又签署仅适用于{payments[override_index]['id']}的补充协议：该笔付款用于清偿本金，剩余依次偿付实现债权费用和利息。该补充协议未被撤销。其他付款记录上乙单方备注‘还本金’，甲未在这些备注上签字，也未以其他方式同意；双方对其他各笔没有补充协议。"
        if round_no >= 9:
            replacements["S06"] = "B保证文件：戊于2022-01-12向甲签署的原件正文为‘乙不履行到期B债务时，戊即无条件向甲清偿，无须甲先向乙追索’；没有使用‘一般’或‘连带’标题。范围包括原B关系按法定限额清算的全部本息及依法允许的结息部分，戊书面同意该结息机制。保证期间条款为‘直至B本息全部还清时为止’，没有另列期间。B原履行期限届满日2023-01-12。甲乙2022-12-28展期至2023-06-30，戊未书面同意展期。B诉讼登记显示：甲2023-07-05以戊为被告请求支付B债务，法院当日有效受理；起诉状副本2023-07-07送达戊，送达内容包括完整给付请求；甲2023-07-09撤诉，法院当日准许。甲另于2023-07-18向戊催告，此前除上述起诉和送达外无其他主张。撤诉不含和解、清偿或甲放弃实体债权。"
            replacements["S10"] = "C保证文件：己在C合同成立当日签署‘乙不能履行C债务、无力偿还时，己才代为向甲清偿’，合同没有保证类型标题，也未另行约定保证期间。程序档案C-诉1：甲于2023-06-08对乙提起关于C的诉讼，当日有效受理，2023-06-10起诉状副本送达乙。甲2023-06-12撤诉，法院同日准许；程序档案C-诉2：甲2023-06-20重新对乙起诉C债务，当日有效受理，截至截日未审判。甲2023-05-08只向己发送催告。己在最终诉讼中主张不再承担保证责任。2023-06-25甲向己递交催告书‘请依原保证合同偿付C’，己仅在‘收件人确认收到’栏签名并写明‘收到，不确认付款义务’，没有新的协商或保证承诺。乙有可供执行财产，无民法典第687条各项例外，己未放弃先诉抗辩；两次诉讼没有已执行款，撤诉不含和解或清偿。"
        if round_no >= 11:
            replacements["S06"] = replacements["S06"].replace("起诉状副本2023-07-07送达戊，送达内容包括完整给付请求", "法院2023-07-07发出起诉状副本，但退回未妥投；截至撤诉日未向戊送达，戊此前也未获知起诉和给付请求").replace("上述起诉和送达外", "上述起诉和退回记录外")
            replacements["S10"] = replacements["S10"].replace("己在C合同成立当日签署", "己于2022-02-07签署").replace("2023-06-20重新", "2023-06-14重新")
            replacements["S07"] = f"C原始借款合同：甲自有资金，乙于2019-02-07实际收到{money(original_c)}元，当日合同成立并起息，没有预扣；该合同从成立起约定到期日2022-12-15，年利率23.50%，逾期仍按同一约定年利率。2022年保证文件不构成另起借款合同或债务更新。C各次诉讼受理时一年期LPR均由题设认可为3.55%，不冒充现实报价查询。实现债权的合理费用1680元在2019-04-17已经发生且到期，双方认可依法可收取；没有其他费用或违约金。合同明确按未清偿本金、实际自然日/365单利累计；每次付款当日不对被偿还本金继续计息，未偿部分到截日止，未付利息不另计息。甲明确请求按照合同成立至2020-08-19当时的司法解释计算该段利息，之后请求适用法律保护范围，不主张超出依法可支持部分的余额。"
            replacements["S09"] = replacements.get("S09","C原始文件：甲乙双方签署的结算总则约定按法律规定办理清偿。").replace("结算总则约定按法律规定办理清偿", "在2019-02-07原合同中约定各笔付款先偿实现债权费用，再偿依法可请求利息，最后偿本金")
        if round_no >= 12:
            replacements["S06"] = replacements["S06"].replace("法院2023-07-07发出起诉状副本，但退回未妥投；截至撤诉日未向戊送达，戊此前也未获知起诉和给付请求", "起诉状副本2023-07-07实际送达戊，包含完整给付请求").replace("上述起诉和退回记录外", "上述起诉和送达外")
            replacements["S06"] += "同一份2022-01-12保证原件还有庚签名，正文由甲、戊、庚共同确认：戊、庚各自以连带责任保证向甲覆盖全部B债务；不是对甲各担一半。戊庚另明确约定承担保证责任后相互有追偿权，相互分担份额为各50%，该内部约定真实有效。庚同意原结息机制但未同意展期，庚的保证期间条款也为‘直至B本息全部还清时为止’。甲仅在2023-07-18首次向庚催告并到达，此前未向庚主张，也未起诉或申请仲裁庚；针对戊的诉状未将庚列为被告，未向庚送达或告知。庚在本案主张不再承担保证责任，戊主张因甲未依法向庚行权使其不能向庚追偿而免除相应部分责任；不存在其他影响该内部追偿的事由。甲将庚也列为最终付款请求对象。戊、庚、己财产状况充足，双方对在依法存续范围内的担保履行能力与价值没有争议。"
        if round_no == 13:
            replacements["S06"] = replacements["S06"].replace("同一份2022-01-12保证原件还有庚签名，正文由甲、戊、庚共同确认", "另有2022-01-12甲与庚独立签署的保证原件，戊未在该原件签署，庚也未在戊的原件签署；两份为各自独立的合同，不是同一合同的分拆页。两份正文一致载明").replace("戊庚另明确约定承担保证责任后相互有追偿权，相互分担份额为各50%，该内部约定真实有效。", "戊庚之间未约定相互追偿或分担份额，也未约定承担连带共同担保；对甲各自的连带责任条款仅涉及各保证人与乙的外部责任，不包含相互追偿或连带共同担保约定。")
        if round_no >= 14:
            replacements["S06"] = replacements["S06"].replace("甲仅在2023-07-18首次向庚催告并到达，此前未向庚主张，也未起诉或申请仲裁庚；针对戊的诉状未将庚列为被告，未向庚送达或告知。", "甲2023-07-06对庚提出完整B给付请求并实际到达庚，这是首次催告；甲2023-07-18再次催告。针对戊的诉状未将庚列为被告，未向庚送达。")
        if round_no >= 13:
            replacements["S07"] = replacements["S07"].replace("3.55%", "3.25%")
        sections = [(key, replacements.get(key, text)) for key, text in sections]
    if round_no >= 13:
        sections = [(key,text.replace("双方也没有在二者之间选择债务或约定抵充顺序。", "双方未在二者之间具体选定债务。SP附件由甲乙共同签署：B/C均到期且有同等资信的全额保证时，以付款日依法可强制请求的年利率比较，先清偿该年利率较高的债务，不计不可强制请求部分；其他情形依法律规定办理。该附件不预先指定B或C。") if key=="S13" else text) for key,text in sections]
    if round_no >= 15:
        share = "50%" if round_no in {17,18,20} else "全部"
        if round_no >= 19:
            promise = f"甲乙辛共同签署《代偿安排》：SP-01结算完成后，辛替代乙成为C剩余债务的{share}部分的债务人，乙退出该部分债务，甲同意免除乙该部分原债务；该部分不是辛与乙共同承担，辛应直接向甲付款。己未书面同意该转移，也没有另立新的保证合同。剩余债务不另起新的借贷合同、没有新资金交付。"
        elif round_no in {16,18}:
            promise = f"甲与辛签署《代偿支持》：只有乙对C无力偿还、经依法强制执行仍不能清偿时，辛才代为支付不能清偿部分的{share}，乙不退出债务。该承诺明确从2023-08-01起至2024-02-01为保证期间；没有放弃先诉抗辩。"
        else:
            promise = f"甲乙辛签署《代偿支持》：辛自愿与乙共同承担C剩余债务的{share}，乙不退出债务；甲可直接要求辛支付该范围，不以乙不能清偿或先行执行乙为条件。辛不是新交付借款，不另起借贷合同。"
        sections.append(("S14", "截日的完整先后顺序经三人确认：先完成SP-01到账和抵充，再签署以下原件，随后甲在已受理的C-诉2中提出最终追加请求，法院当日依法准许追加辛为被告；甲请求乙、己、辛承担各自实体责任。A、B则在2023-08-01新受理案件中审查，本题并列核对这些实体请求，不判是否合并程序。" + promise + "范围以SP-01之后C各项金额分别取分后合计为基数。债务转移有比例时先算辛份额并四舍五入到分，乙未退出部分为合计减该份额；共同承担的比例只限制辛的范围，不缩减乙本来的全部责任；代为清偿的比例也不缩减乙的债务。辛为完全行为能力的自然人，乙及己均无先诉抗辩例外，既有C前诉仍未审判，也没有执行受偿。SP-01之后没有其他付款。"))
        # Preserve operative terms; remove the dossier editor's legal deductions.
        if round_no >= 19:
            operative = f"甲乙辛三方原件《代偿安排》正文：‘在今日银行SP-01结算完成后，C尚欠各项的{share}，此后由辛独自向甲履行。甲就这一部分不再向乙请求，乙对此不再向甲负付款义务。未包括的部分仍依原合同履行。’己没有签署该文书，亦没有就其内容给出其他书面同意，甲己之间没有另签新保证文件。"
        elif round_no in {16,18}:
            operative = f"甲辛原件《代偿支持》正文：‘甲应先依法对乙追索C，依法强制执行后仍不能清偿的部分，辛再向甲支付其中{share}。本安排不免除乙原合同项下的付款义务，辛不放弃要求先对乙追索执行的权利。本安排的责任承担期间为2023-08-01至2024-02-01。’"
        else:
            operative = f"甲乙辛三方原件《代偿支持》正文：‘今日SP-01结算后C尚欠各项的{share}，辛自愿与乙一并向甲负担。甲可以单独向辛请求该范围的付款，不以先向乙追索、执行或乙无力偿还为条件。本安排不免除乙原合同项下的付款义务。’"
        raw_events = "2023-08-01归档原件及程序回执：13:40上述主体完成签署。16:10甲向C-诉2法院提交追加请求，法院当日准许追加辛为被告，甲请求乙、己、辛依其各自实体义务支付。A、B另于同日新受理；本题并列核对实体请求，不判断合并程序。"
        raw_scope = "文书共同条款：范围以今日SP-01结算后的C本金、利息、费用各项分别取分再合计为基数；涉及50%时该份额四舍五入到分，其余数额按合计减该份额计算。原合同的交付日期、利率、到期日等未作其他改动，未另有现金交付。己、辛均有履行能力，乙有可供执行财产且不存在随题规则所列先诉抗辩例外；C-诉2截至截日未审判，尚无执行受偿，也没有SP-01之后的付款。"
        revised = []
        for key, text in sections:
            if key == "S06":
                text = text.replace("不是对甲各担一半。", "").replace("该内部约定真实有效。", "三人承认上述签署及条款记载真实。")
            if key == "S13":
                text = text.replace("2023-08-01乙另向甲实际付款", "2023-08-01 09:20乙另向甲实际付款")
            if key == "S14":
                text = raw_events + operative + raw_scope
            if key == "S12":
                text += "以下是最终书面意见中的法律主张，不是双方认可的事实或法院认定：戊称既然内部各50%，自己对甲也只担50%；己称C借款成立于2019年，自己的保证类型应随该借款适用旧规则；甲称辛签署‘代偿支持’无论正文如何均应立即支付；乙称后来第三人文书应改变早先SP-01在B、C之间的抵充。"
            revised.append((key, text))
        sections = revised
    if level >= 3:
        sections = sections[::2] + sections[1::2]
    dossier = header + "\n\n".join(f"## [{key}]\n{text}" for key,text in sections)
    contract = {"fields": {k: ("金额，人民币元" if isinstance(v,str) and v.endswith(tuple(str(i) for i in range(10))) else "合同或保证状态") for k,v in expected.items()},
                "guarantee_states": ["invalid_accessory", "expired", "joint", "general_preserved_not_yet_enforceable"],
                "money": "数字或十进制金额字符串均可；最终每项四舍五入至分，分项取分后计算总额", "basis": "简短事实、法条、必要算式，须解释决定性法律分支；不要求内部思维链"}
    if shared_payment:
        contract["fields"]["B_protected_total"] = "截日全部已付金额抵充后，B仍可请求的受保护本息余额，人民币元"
        contract["fields"]["B_initial_principal"] = "B最初实际交付本金，不是付款后的未偿本金，人民币元"
    if round_no >= 10:
        contract["evaluation"] = "法律分支、最终金额、公开计算依据分别审查。高精度中间展示偏差不超过0.01元且不改变最终取分、规则、日数或公式时，仅记录质量提示，不计实质错误；必要法律判断、日数、公式或必答最终金额错误仍属实质错误。学生只返回JSON，宿主负责落盘。"
    if round_no >= 12:
        contract["guarantee_states"].append("joint_limited_due_lost_recourse")
        contract["fields"]["B_joint_payment_limit"] = "在截日到账及最终清偿后，甲请求戊立即支付B所能支持的最高金额，不计入借款人总额，人民币元"
    if round_no >= 15:
        contract["third_party_types"] = ["debt_joining","guarantee","debt_transfer","nonbinding_support","unresolved"]
        contract["fields"]["C_third_party_type"] = "辛在C关系中承担义务的法律类型，不以文件标题代替正文意思"
        contract["fields"]["C_third_party_payment_limit"] = "甲在本次诉讼中请求辛立即支付C可支持的最高金额，人民币元，不重复加到乙的总额"
    if round_no >= 19:
        contract["guarantee_states"].append("released_due_debt_transfer")
        contract["fields"]["C_original_borrower_liability"] = "SP-01及S14之后，乙本人仍应承担的C未偿金额，人民币元"
        contract["fields"]["borrower_total"] = "最终请求乙本人支付的总额，含其仍应承担的各关系；不含已退出部分或辛的同一债务重复额"
        contract["C_amount_scope"] = "C本金、利息、费用字段记录整个C借贷关系的未偿余额；乙是否退出全部或部分须另根据S14审查，不把该三个字段自动当作乙本人责任。"
    if round_no >= 15:
        contract.pop("guarantee_states", None)
        contract.pop("third_party_types", None)
        contract["status_values"] = "自行概括法律状态与义务类型，可用中文或英文；不限定标签列表或唯一措辞，依据须支持所填状态。"
    proof = {"B_periods": proof_b, "B_contractual_terminal": str(terminal_contract), "B_global_cap": str(terminal_cap),
             "B_initial_actual_principal": str(original_b), "B_whole_days": (cutoff-b_start).days,
             "C_payment_allocations": proof_c, "C_final_period_days": (cutoff-c_last).days,
             "C_final_unrounded_interest": str(c_interest), "A_actual_less_return": f"{a_actual}-{a_returns}",
             "B_guarantee_period_end": "2023-07-12", "C_guarantee_period_end": "2023-06-15", "shared_cutoff_payment": shared_payment}
    save(folder,"engineering-reference.json",{"answer":expected,"proof":proof,"expert_review":False,"reference_kind":"hypothetical_fact_and_frozen_rule_derived_engineering_reference"})
    record={"loans":{"A":{"actual":str(a_actual),"returned":str(a_returns)},"B":{"original_actual":str(original_b),"paper":str(paper_b),"rate":str(rate_b),"rolls":bills},"C":{"actual":str(original_c),"payments":payments}},"level":level,"round":round_no,"cap":str(cap),"cutoff":str(cutoff)}
    if shared_payment:
        record["shared_cutoff_payment"] = shared_payment
    if round_no >= 9:
        record["procedural_mechanism"] = {"B_type_clause": "immediate_unconditional", "B_initial_maturity": "2023-01-12", "B_filed": "2023-07-05", "B_served": "2023-07-07", "B_withdrawn": "2023-07-09", "C_type_clause": "only_if_unable", "C_initial_maturity": "2022-12-15", "C_filed": "2023-06-08", "C_withdrawn": "2023-06-12", "C_refiled": "2023-06-20", "C_later_signature": "receipt_only_not_new_promise", "basis": ["guarantee-2020:25", "guarantee-2020:31", "guarantee-2020:32", "guarantee-2020:34"]}
    if round_no >= 11:
        record["procedural_mechanism"].update({"B_served":None,"C_refiled":"2023-06-14","C_guarantee_signed":"2022-02-07"})
        record["loans"]["C"].update({"started_at":str(c_start),"contractual_rate":str(rate_c),"protected_rate_schedule":c_schedule,"suit_lpr":"0.0355","old_period_request":True})
    if round_no >= 12:
        record["procedural_mechanism"]["B_served"] = "2023-07-07"
        record["co_guarantee"] = {"external_scope_each":"all_B","internal_recourse_share":"0.5","second_guarantor_first_request":"2023-07-18","second_guarantor_period_end":"2023-07-12","basis":["guarantee-2020:13","guarantee-2020:29"],"researcher_liability_limit":expected["B_joint_payment_limit"]}
    if round_no>=13:
        record["loans"]["C"]["suit_lpr"] = "0.0325"
        record["co_guarantee"].update({"internal_recourse_exists":round_no!=13,"internal_recourse_share":None if round_no==13 else "0.5","same_contract":round_no!=13,"second_guarantor_first_request":"2023-07-06" if round_no>=14 else "2023-07-18","lost_recourse_reduction":False})
    if round_no>=15:
        record["third_party_mechanism"] = {"type":expected["C_third_party_type"],"share":"0.5" if round_no in {17,18,20} else "1","sequence":"after_SP_before_final_litigation","old_guarantor_written_consent":False,"third_party_immediate_limit":expected["C_third_party_payment_limit"],"original_borrower_remaining_C":expected.get("C_original_borrower_liability"),"no_new_loan":True}
    save(folder,"scenario-record.json",record)
    projection = {"policy":"contract_and_event_without_researcher_conclusions" if round_no>=15 else "neutral_primary_records" if round_no>=6 else "summarized_stipulations","enabled_from_round":15 if round_no>=15 else 6,"rationale":"保留同一交易号、银行执行状态、双方补充协议与单方备注；删除整理者归属结论和责任状态检查表，不改变已生成参考的实质事实。","skill_version":f"1.2.{round_no-1}"}
    if round_no >= 15:
        projection.update({"basis":["rounds/14/stage-P2.json:shortcut_audit","repeated_correct_legal_branches"],"changes":["原合同条款代替共同承担比例的整理者法律解释","以09:20付款、13:40签约、16:10诉请记录重建事件链","加入可被原件与规范验证的单方法律主张，不添加争议事实","不向学生列保证状态和第三人类型答案选项"],"numeric_reference_unchanged":True,"old_rounds_not_rewritten":True})
    return dossier, contract, expected, {"kind":"fictional_derivative","new_scenario":True,"not_original_case_evidence":True,"changes":["增加独立虚构B/C债务、预扣利息与结息借据、分时付款和保证状态","原案只是研究动机；全部新情景参考重新由题设与法条建立"],"student_projection":projection,"material_repairs":{"basis":"rounds/02/stage-P3.json","changes":["明确B实际到账、起息和成立日期，不能以借据日期推定","A的清算约定改为如被认定无效的条件式，不预给效力结论"],"previous_rounds_not_rewritten":True},"mechanisms":["actual_disbursement_before_capitalization","period_cap_and_whole_term_cap","agreement_exception_to_payment_priority","accessory_validity_and_guarantee_period","preservation_vs_immediate_enforcement"]}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("round",type=int)
    parser.add_argument("--level",type=int,default=1)
    args=parser.parse_args()
    assert 1 <= args.round <= 20
    boundary = ROOT/".local/hardness-boundary-stop"
    if boundary.exists():
        try: stop_from = json.loads(boundary.read_text())["stop_from_round"]
        except (ValueError,KeyError): stop_from = 5
        if args.round >= stop_from:
            print("Safe round boundary reached; reconfigure before any new model submission.",flush=True)
            raise SystemExit(86)
    folder=CAMPAIGN / "rounds" / f"{args.round:02}"
    folder.mkdir(parents=True,exist_ok=True)
    if (folder/"student-files.json").exists():
        repair_unconsumed_reference(folder)
        return
    laws=authorities()
    if args.round >= 9:
        extra = json.loads((CAMPAIGN / "guarantee-authorities.json").read_text())
        text = (ROOT / ".local/hardness-laws/guarantee-2020.txt").read_bytes().decode("utf-8")
        for row in extra:
            assert digest(text) == row["full_text_sha256"], "Frozen guarantee text changed"
            assert digest(row["quote"]) == row["excerpt_sha256"], "Frozen guarantee excerpt changed"
        laws = laws + extra
    if args.round >= 11:
        meta = next(row for row in laws if row["source_id"] == "lending-2015")
        text = (ROOT / ".local/pilot-laws/lending-2015.txt").read_bytes().decode("utf-8")
        assert digest(text) == meta["textSha256"], "Frozen old-rate authority changed"
        start = text.index("第二十六条")
        end = text.index("第二十七条",start+5)
        quote = text[start:end].strip()
        laws = laws + [{"source_id":"lending-2015","provision":"26","quote":quote,"url":meta["url"],"version":meta["version"],"effective_from":meta["effective_from"],"effective_to":meta["effective_to"],"retrievedAt":meta["retrievedAt"],"full_text_sha256":digest(text),"excerpt_sha256":digest(quote),"locator":{"start":start,"end":end,"index_unit":"Python Unicode code points"},"verification":"exact_excerpt_from_frozen_official_text"}]
    if args.round >= 12:
        meta = next(row for row in laws if row["source_id"] == "guarantee-2020")
        text = (ROOT / ".local/hardness-laws/guarantee-2020.txt").read_bytes().decode("utf-8")
        assert digest(text) == meta["full_text_sha256"]
        for article,first,last in [(13,"第十三条","第十四条"),(29,"第二十九条","第三十条")]:
            start = text.index(first)
            end = text.index(last,start+len(first))
            quote = text[start:end].strip()
            laws.append({**meta,"provision":str(article),"quote":quote,"excerpt_sha256":digest(quote),"locator":{"start":start,"end":end,"index_unit":"Python Unicode code points"}})
    if args.round>=15:
        for source,file,specs in [("civil-code-2020",".local/pilot-laws/civil-code-2020.txt",[(552,"第五百五十二条","第五百五十三条"),(697,"第六百九十七条","第六百九十八条")]),("guarantee-2020",".local/hardness-laws/guarantee-2020.txt",[(36,"第三十六条","第三十七条")])]:
            meta = next(row for row in laws if row["source_id"]==source)
            text = (ROOT/file).read_bytes().decode("utf-8")
            assert digest(text)==meta.get("full_text_sha256",meta.get("textSha256"))
            for article,first,last in specs:
                start=text.index(first);end=text.index(last,start+len(first));quote=text[start:end].strip()
                laws.append({**meta,"provision":str(article),"quote":quote,"excerpt_sha256":digest(quote),"full_text_sha256":digest(text),"locator":{"start":start,"end":end,"index_unit":"Python Unicode code points"}})
    if args.round>=20:
        meta=next(row for row in laws if row["source_id"]=="civil-code-2020")
        text=(ROOT/".local/pilot-laws/civil-code-2020.txt").read_bytes().decode("utf-8")
        assert digest(text)==meta.get("full_text_sha256",meta.get("textSha256"))
        start=text.index("第五百五十一条");end=text.index("第五百五十二条",start+7)
        quote=text[start:end].strip()
        laws.append({**meta,"provision":"551","quote":quote,"excerpt_sha256":digest(quote),"full_text_sha256":digest(text),"locator":{"start":start,"end":end,"index_unit":"Python Unicode code points"}})
    dossier,contract,expected,origin=original(folder,laws) if args.round==1 else fictional(folder,laws,args.level,args.round)
    repair_unconsumed_reference(folder)
    if args.round>=8:
        origin["cross_branch_coupling"]={"enabled_from_round":8,"span":"S13","amount":"25000.00","dependency":"保证存续状态 -> 民法典560条B/C债务抵充 -> 未偿余额","scope":"双方限定只清偿B/C；不将先诉抗辩视为保证消灭；新增题设与参考，不复用旧题计数"}
        origin["mechanisms"].append("guarantee_state_to_undesignated_payment_allocation")
    if args.round >= 9:
        origin["procedural_coupling"] = {"enabled_from_round":9, "spans":["S06","S10","S13"], "authority":"https://www.court.gov.cn/zixun/xiangqing/282721.html", "dependency":"保证条款类型与期间 -> 起诉/送达/撤诉/再诉及收件签名 -> 保证存续 -> B/C抵充及剩余余额", "hypothesis":"第8轮前三答均通过简单的催告/起诉分支；改用原始程序文件，区分两种保证的撤诉效果与仅收件签名，不增加算术量。", "not_retroactive":True}
        origin["mechanisms"].append("guarantee_type_withdrawal_service_refiling_receipt_signature")
    if args.round >= 10:
        origin["cap_shortcut_repair"] = {"enabled_from_round":10, "basis":"rounds/08/stage-P6.json", "rate":"13.20%", "cap":"14.80%", "hypothesis":"前轮整体上限遮蔽逐次结息；降低有效合同利率，使合法结息候选额必须与独立上限比较，不能只用整体上限作答。保留原日期和归档次数，不靠新增运算量加难。", "not_retroactive":True}
    if args.round >= 11:
        origin["temporal_rate_coupling"] = {"enabled_from_round":11,"basis":"previous high-success guarantee and amount branches; rounds/08/stage-P6.json shortcut audit","spans":["S07","S08","S09","S10","S13"],"dependency":"2019原借款成立与2022保证成立分开 -> 新受理旧合同利率过渡 -> 付款跨越规范分界的合法利息 -> 顺序抵充及后续本金；未送达撤诉与期间内再诉重新影响担保比较","rates_are_researcher_reference_only":True,"not_retroactive":True}
        origin["mechanisms"].append("old_loan_new_guarantee_transitional_rate_and_payment_sequence")
    if args.round >= 12:
        origin["co_guarantee_coupling"] = {"enabled_from_round":12,"spans":["S06","S13"],"dependency":"对不同保证人行权的相对效力 -> 明确相互追偿及份额 -> 丧失追偿的责任减免 -> 担保覆盖范围比较与抵充 -> 戊最高即时责任","not_retroactive":True,"reference_requires_P4_and_P6_review":True}
        origin["mechanisms"].append("relative_guarantee_preservation_lost_recourse_and_payment_security_comparison")
    if args.round>=13:
        origin["relative_rights_variant"] = {"round":args.round,"same_contract":args.round!=13,"mutual_recourse":args.round!=13,"second_guarantor_timely_request":args.round>=14,"rate_priority_agreement":"After both-debts due and equally fully secured, compare legally enforceable current annual rates, not nominal disallowed interest.","C_suit_lpr":"3.25%","not_retroactive":True}
    if args.round>=15:
        origin["third_party_sequence_coupling"] = {"round":args.round,"span":"S14","dependency":"SP时点有效担保与可请求利率 -> 先清偿 -> 后签文件实质为保证/加入/转移 -> 原债务人/新主体/原保证人最终责任","new_loan_not_created":True,"not_retroactive":True}
    if args.round>=20:
        origin["authority_completion"]={"enabled_from_round":20,"provision":"civil-code-2020:551","reason":"Supply creditor-consent formation rule for debt transfer as well as guarantee consequences; prior round 19 inputs and audits are not rewritten.","official_frozen_full_text":True}
    student={"dossier.md":dossier,"rules.json":laws,"answer-contract.json":contract}
    save(folder,"student-files.json",student)
    save(folder,"source.json",{**origin,"dossier_sha256":digest(dossier),"authority_manifest_sha256":digest(json.dumps(laws,ensure_ascii=False)),"use":"local_research_only","expert_review":False})
    span_ids=[f"S{i:02}" for i in range(1,15 if args.round>=15 else 14 if args.round>=8 else 13)] if args.round>1 else ["p-006","p-007","p-008","p-009","p-012","p-013","p-014","p-015","p-016","p-017"]
    save(folder,"material-pack.json",{"schema_version":"1.0","kind":"case","source":origin,"normalized_text":dossier,"span_ids":span_ids,"normalization_method":"deterministic_text_projection","claims_and_stipulations_separated":True,"quality":"experimental_not_expert_verified"})
    save(folder,"answer-contract.json",contract)
    save(folder,"expected.json",expected)
    print(json.dumps({"round":args.round,"level":args.level,"fictional":args.round>1,"text_chars":len(dossier)},ensure_ascii=False))


if __name__=="__main__":
    main()
