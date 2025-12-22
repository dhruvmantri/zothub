import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { TrendingUp, TrendingDown, Eye, Users, Briefcase, Calendar } from "lucide-react";

const viewsData = [
  { name: 'Week 1', views: 420, applications: 12 },
  { name: 'Week 2', views: 580, applications: 18 },
  { name: 'Week 3', views: 650, applications: 24 },
  { name: 'Week 4', views: 890, applications: 35 },
  { name: 'Week 5', views: 1050, applications: 42 },
  { name: 'Week 6', views: 980, applications: 38 },
];

const opportunityPerformance = [
  { name: 'Technical Lead', views: 342, applications: 24 },
  { name: 'Marketing Intern', views: 189, applications: 15 },
  { name: 'Campus Outreach', views: 256, applications: 32 },
  { name: 'Mobile App Project', views: 421, applications: 45 },
];

const applicationStatus = [
  { name: 'Pending', value: 12, color: 'hsl(38, 92%, 50%)' },
  { name: 'Reviewed', value: 8, color: 'hsl(222, 47%, 15%)' },
  { name: 'Accepted', value: 15, color: 'hsl(142, 76%, 36%)' },
  { name: 'Rejected', value: 5, color: 'hsl(0, 84%, 60%)' },
];

const eventAttendance = [
  { name: 'Hackathon', rsvps: 156, attended: 142 },
  { name: 'Tech Talk', rsvps: 45, attended: 38 },
  { name: 'Workshop', rsvps: 32, attended: 28 },
  { name: 'General Meeting', rsvps: 120, attended: 98 },
];

export function ClubAnalytics() {
  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Views</p>
                <p className="text-3xl font-bold text-foreground">4,570</p>
              </div>
              <div className="flex items-center gap-1 text-success">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-medium">+12%</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Applications</p>
                <p className="text-3xl font-bold text-foreground">169</p>
              </div>
              <div className="flex items-center gap-1 text-success">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-medium">+8%</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Event RSVPs</p>
                <p className="text-3xl font-bold text-foreground">353</p>
              </div>
              <div className="flex items-center gap-1 text-success">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm font-medium">+15%</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
                <p className="text-3xl font-bold text-foreground">3.7%</p>
              </div>
              <div className="flex items-center gap-1 text-destructive">
                <TrendingDown className="w-4 h-4" />
                <span className="text-sm font-medium">-2%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Views & Applications Over Time */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Views & Applications Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={viewsData}>
                  <defs>
                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(222, 47%, 15%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(222, 47%, 15%)" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 12 }}
                    axisLine={{ stroke: 'hsl(220, 13%, 91%)' }}
                  />
                  <YAxis 
                    tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 12 }}
                    axisLine={{ stroke: 'hsl(220, 13%, 91%)' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(0, 0%, 100%)',
                      border: '1px solid hsl(220, 13%, 91%)',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="views" 
                    stroke="hsl(222, 47%, 15%)" 
                    fillOpacity={1} 
                    fill="url(#colorViews)" 
                    strokeWidth={2}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="applications" 
                    stroke="hsl(38, 92%, 50%)" 
                    fillOpacity={1} 
                    fill="url(#colorApps)" 
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span className="text-sm text-muted-foreground">Views</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-accent" />
                <span className="text-sm text-muted-foreground">Applications</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Application Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Application Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={applicationStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {applicationStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(0, 0%, 100%)',
                      border: '1px solid hsl(220, 13%, 91%)',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {applicationStatus.map((status) => (
                <div key={status.name} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: status.color }} 
                  />
                  <span className="text-xs text-muted-foreground">{status.name}</span>
                  <span className="text-xs font-medium ml-auto">{status.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Opportunity Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Opportunity Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={opportunityPerformance} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                  <XAxis 
                    type="number"
                    tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 12 }}
                    axisLine={{ stroke: 'hsl(220, 13%, 91%)' }}
                  />
                  <YAxis 
                    dataKey="name" 
                    type="category"
                    tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 12 }}
                    axisLine={{ stroke: 'hsl(220, 13%, 91%)' }}
                    width={100}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(0, 0%, 100%)',
                      border: '1px solid hsl(220, 13%, 91%)',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="views" fill="hsl(222, 47%, 15%)" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="applications" fill="hsl(38, 92%, 50%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Event Attendance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Event Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={eventAttendance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
                  <XAxis 
                    dataKey="name"
                    tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 12 }}
                    axisLine={{ stroke: 'hsl(220, 13%, 91%)' }}
                  />
                  <YAxis 
                    tick={{ fill: 'hsl(220, 9%, 46%)', fontSize: 12 }}
                    axisLine={{ stroke: 'hsl(220, 13%, 91%)' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(0, 0%, 100%)',
                      border: '1px solid hsl(220, 13%, 91%)',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="rsvps" name="RSVPs" fill="hsl(222, 47%, 15%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="attended" name="Attended" fill="hsl(142, 76%, 36%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span className="text-sm text-muted-foreground">RSVPs</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-success" />
                <span className="text-sm text-muted-foreground">Attended</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Top Performing Listings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { title: "Winter Hackathon 2025", type: "event", views: 523, conversions: 156, rate: "29.8%" },
              { title: "Mobile App Project", type: "opportunity", views: 421, conversions: 45, rate: "10.7%" },
              { title: "Technical Lead", type: "opportunity", views: 342, conversions: 24, rate: "7.0%" },
              { title: "Campus Outreach Volunteer", type: "opportunity", views: 256, conversions: 32, rate: "12.5%" },
            ].map((item, index) => (
              <div 
                key={index}
                className="flex items-center gap-4 p-4 rounded-lg bg-secondary/30"
              >
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                  {item.type === "event" ? (
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{item.title}</p>
                  <Badge variant="muted" className="capitalize mt-1">{item.type}</Badge>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground">{item.views} views</p>
                  <p className="text-sm text-muted-foreground">
                    {item.conversions} {item.type === "event" ? "RSVPs" : "apps"} ({item.rate})
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
