"use client"

import { cn } from "@/lib/utils"
import { ArrowUpRight, ArrowDownRight, Clock, Users, ShieldAlert, Award, FileText, ChevronRight } from "lucide-react"

export function MetricSquare({ 
  title, 
  value, 
  icon: Icon, 
  colorVar 
}: { 
  title: string, 
  value: string, 
  icon: any, 
  colorVar: string 
}) {
  return (
    <div 
      className="rounded-2xl p-4 flex flex-col justify-between h-32 relative overflow-hidden group cursor-pointer transition-transform hover:-translate-y-1 hover:shadow-lg"
      style={{ backgroundColor: `var(${colorVar})` }}
    >
      <div className="flex justify-between items-start">
        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-white" />
        </div>
        <ArrowUpRight className="w-3 h-3 text-white/50 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div>
        <div className="text-[10px] text-white/70 font-medium mb-1">{title}</div>
        <div className="text-xl font-bold text-white">{value}</div>
      </div>
    </div>
  )
}

export function PillMetric({ 
  title, 
  value, 
  trend, 
  icon: Icon, 
  iconBg 
}: { 
  title: string, 
  value: string, 
  trend: string, 
  icon: any, 
  iconBg: string 
}) {
  return (
    <div className="bg-[var(--color-dash-surface)] rounded-full p-2 pr-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors">
      <div className="flex items-center gap-3">
        <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", iconBg)}>
          <Icon className={cn("w-5 h-5", iconBg.includes('lime') ? 'text-black' : 'text-white')} />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--color-text-muted)] font-medium">{title}</span>
            <span className="text-[8px] bg-white/10 text-white px-1.5 py-0.5 rounded-sm">{trend}</span>
          </div>
          <span className="text-base font-bold text-white leading-tight">{value}</span>
        </div>
      </div>
      <ArrowUpRight className="w-3 h-3 text-[var(--color-text-muted)]" />
    </div>
  )
}

export interface TeamData {
  id: string
  name: string
  logo: string
  multiplier: number
  fillPercentage: number
  fundsGoal: number
  users: number
  funds: number
  bestPlayers: { id: string; avatar: string }[]
  proCount: number
  pointsIncrease: number
  weekActivity: number
  weekAmount: number
}

export function TeamWidget({ data }: { data: TeamData }) {
  return (
    <div className="bg-[var(--color-dash-surface)] rounded-2xl p-4">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 overflow-hidden p-1">
            <img src={data.logo} alt={data.name} className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">{data.name}</span>
              <span className="text-[8px] bg-white/10 px-1.5 py-0.5 rounded-full text-white">x{data.multiplier.toFixed(1)}</span>
            </div>
            <div className="text-[10px] text-[var(--color-text-muted)]">{data.fillPercentage}% Full</div>
          </div>
        </div>
        <button className="text-[var(--color-text-muted)] hover:text-white"><span className="text-lg leading-none">⋮</span></button>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex justify-end mb-1">
          <span className="text-xs font-bold text-[var(--color-lime)]">${data.fundsGoal.toLocaleString()}</span>
        </div>
        <div className="h-1 bg-white/10 rounded-full relative">
          <div className="absolute left-0 top-0 h-full bg-[var(--color-lime)] rounded-full" style={{ width: `${data.fillPercentage}%` }} />
          <div 
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-[var(--color-lime)]" 
            style={{ left: `${data.fillPercentage}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="flex divide-x divide-white/10 mb-5">
        <div className="flex-1 flex items-center gap-3 pr-2">
          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><Users className="w-4 h-4 text-white/70" /></div>
          <div>
            <div className="text-[10px] text-[var(--color-text-muted)]">Users</div>
            <div className="text-sm font-bold text-white">{data.users}</div>
          </div>
        </div>
        <div className="flex-1 flex items-center gap-3 pl-4">
          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><span className="text-[var(--color-lime)] font-bold text-sm">$</span></div>
          <div>
            <div className="text-[10px] text-[var(--color-text-muted)]">Funds</div>
            <div className="text-sm font-bold text-white">${data.funds >= 1000 ? (data.funds/1000).toFixed(1) + 'k' : data.funds}</div>
          </div>
        </div>
      </div>

      {/* Best Players */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span className="text-[11px] text-white font-semibold">Best Players</span>
          </div>
          <Clock className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
        </div>
        
        <div className="flex items-center gap-2">
          <div className="text-center mr-1">
            <div className="text-[10px] text-[var(--color-lime)]">Pro</div>
            <div className="text-lg font-bold text-white leading-none">{data.proCount}</div>
          </div>
          
          <div className="flex -space-x-2">
            {data.bestPlayers.map(p => (
              <img key={p.id} src={p.avatar} className="w-7 h-7 rounded-full border-2 border-[var(--color-dash-surface)] object-cover" />
            ))}
          </div>
          
          <ArrowUpRight className="w-3 h-3 text-[var(--color-lime)] ml-auto" />
          <span className="text-[10px] font-bold text-white">+{data.pointsIncrease}</span>
          <button className="w-6 h-6 rounded-full bg-white text-black flex items-center justify-center ml-1">
            <span className="text-lg leading-none mt-[-2px]">+</span>
          </button>
        </div>
      </div>

      {/* Week Activity */}
      <div className="bg-black/20 rounded-xl p-3 flex justify-between items-center">
        <div>
          <div className="text-[11px] text-white font-semibold mb-0.5">Week activity</div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-[var(--color-text-muted)]">Last week</span>
            <span className={cn("text-[8px] px-1 rounded-sm", data.weekActivity >= 0 ? "bg-[var(--color-lime)]/20 text-[var(--color-lime)]" : "bg-[var(--color-dash-red)]/50 text-[var(--color-danger)]")}>
              {data.weekActivity >= 0 ? '+' : ''}{data.weekActivity}%
            </span>
          </div>
        </div>
        <div className="bg-white text-black text-[10px] font-bold px-2 py-1 rounded-md">${data.weekAmount.toLocaleString()}</div>
      </div>
    </div>
  )
}

export interface Transaction {
  id: string
  type: string
  amount: number
  date: string
  isPositive: boolean
  avatars: string[]
  badge: string
}

export function TransactionList({ transactions }: { transactions: Transaction[] }) {
  return (
    <div className="bg-[var(--color-dash-surface)] rounded-2xl p-4 h-full min-h-[200px]">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-white">Transactions</h3>
        <button><span className="text-lg leading-none text-[var(--color-text-muted)]">≡</span></button>
      </div>

      <div className="space-y-3">
        {transactions.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)] py-4 text-center">No transactions yet.</p>
        ) : (
          transactions.map(t => (
          <div key={t.id} className="flex items-center justify-between bg-white/5 p-2 rounded-xl">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", t.isPositive ? "bg-[var(--color-lime)] text-black" : "bg-white/10 text-white")}>
                <span className="font-bold">$</span>
              </div>
              <div>
                <div className="text-[11px] font-bold text-white">{t.type}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <div className="flex -space-x-1.5">
                    {t.avatars.map((avatar, i) => (
                      <img key={i} src={avatar} className="w-4 h-4 rounded-full border border-black" />
                    ))}
                  </div>
                  {t.badge && (
                    <span className="text-[9px] bg-white text-black px-1.5 rounded-full font-bold ml-1">{t.badge}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[8px] text-[var(--color-text-muted)] mb-1">{t.date}</div>
              <div className={cn("text-sm font-bold", t.isPositive ? "text-[var(--color-lime)]" : "text-white")}>
                {t.isPositive ? '+' : '-'}{Math.abs(t.amount)}
              </div>
            </div>
          </div>
          ))
        )}
      </div>
    </div>
  )
}
